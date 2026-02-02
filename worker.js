/**
 * X Post Grabber - Cloudflare Worker
 * 使用 fxtwitter API 获取 X (Twitter) 文章内容
 */

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return jsonResponse({ error: '请提供 url 参数' }, 400);
    }

    // 验证是否是 X/Twitter URL 并提取信息
    const match = targetUrl.match(/^https?:\/\/(x\.com|twitter\.com)\/(\w+)\/status\/(\d+)/);
    if (!match) {
      return jsonResponse({ error: '请提供有效的 X/Twitter 文章链接' }, 400);
    }

    const username = match[2];
    const tweetId = match[3];

    try {
      // 使用 fxtwitter API 获取推文数据
      const apiUrl = `https://api.fxtwitter.com/${username}/status/${tweetId}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'X-Post-Grabber/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return jsonResponse({ 
          error: `获取推文失败: ${response.status}`,
          status: response.status 
        }, response.status);
      }

      const data = await response.json();
      
      if (!data.tweet) {
        return jsonResponse({ error: '未找到推文内容' }, 404);
      }

      const tweet = data.tweet;
      
      // 构建返回数据
      const result = {
        success: true,
        data: {
          userInfo: {
            name: tweet.author?.name || '',
            username: '@' + (tweet.author?.screen_name || username),
            avatarUrl: tweet.author?.avatar_url || ''
          },
          textContent: {
            text: tweet.text || '',
            html: formatTweetHtml(tweet.text || '')
          },
          mediaContent: {
            images: extractImages(tweet),
            videos: []
          },
          timeInfo: {
            datetime: tweet.created_at || '',
            displayText: formatTime(tweet.created_timestamp)
          },
          articleTitle: null,
          originalUrl: targetUrl
        }
      };

      return jsonResponse(result);

    } catch (error) {
      return jsonResponse({ 
        error: '抓取失败: ' + error.message 
      }, 500);
    }
  },
};

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// JSON 响应工具函数
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// 格式化推文文本为 HTML
function formatTweetHtml(text) {
  if (!text) return '';
  
  // 转义 HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // 转换链接
  html = html.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank">$1</a>'
  );
  
  // 转换 @用户名
  html = html.replace(
    /@(\w+)/g,
    '<a href="https://x.com/$1" target="_blank">@$1</a>'
  );
  
  // 转换 #话题
  html = html.replace(
    /#(\w+)/g,
    '<a href="https://x.com/hashtag/$1" target="_blank">#$1</a>'
  );
  
  // 换行转 <br> 或 <p>
  html = '<p>' + html.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
  
  return html;
}

// 提取图片
function extractImages(tweet) {
  const images = [];
  
  if (tweet.media?.photos) {
    tweet.media.photos.forEach(photo => {
      images.push({
        src: photo.url || '',
        alt: photo.altText || ''
      });
    });
  }
  
  // 也检查 media.all
  if (tweet.media?.all) {
    tweet.media.all.forEach(item => {
      if (item.type === 'photo' && item.url) {
        // 避免重复
        if (!images.find(img => img.src === item.url)) {
          images.push({
            src: item.url,
            alt: item.altText || ''
          });
        }
      }
    });
  }
  
  return images;
}

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) return '';
  
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
