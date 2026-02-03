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
      
      // 检测是否是长文章格式
      const isArticle = !!tweet.article;
      
      let textContent, mediaContent, articleTitle;
      
      if (isArticle) {
        // 长文章格式 - 从 article.content.blocks 解析
        const article = tweet.article;
        articleTitle = article.title || '';
        
        const { text, html, images } = parseArticleBlocks(article.content?.blocks || [], article.content?.entityMap || []);
        textContent = { text, html };
        
        // 提取封面图
        const coverImages = [];
        if (article.cover_media?.media_info?.original_img_url) {
          coverImages.push({
            src: article.cover_media.media_info.original_img_url,
            alt: articleTitle
          });
        }
        
        // 合并封面图和文章内图片
        mediaContent = {
          images: [...coverImages, ...images],
          videos: []
        };
      } else {
        // 普通推文格式
        articleTitle = null;
        textContent = {
          text: tweet.text || '',
          html: formatTweetHtml(tweet.text || '')
        };
        mediaContent = {
          images: extractImages(tweet),
          videos: []
        };
      }
      
      // 构建返回数据
      const result = {
        success: true,
        data: {
          isArticle,
          userInfo: {
            name: tweet.author?.name || '',
            username: '@' + (tweet.author?.screen_name || username),
            avatarUrl: tweet.author?.avatar_url || ''
          },
          textContent,
          mediaContent,
          timeInfo: {
            datetime: tweet.created_at || '',
            displayText: formatTime(tweet.created_timestamp)
          },
          articleTitle,
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

// 解析长文章的 blocks 结构
function parseArticleBlocks(blocks, entityMap) {
  const textParts = [];
  const htmlParts = [];
  const images = [];
  
  // 构建 entityMap 查找表
  const entityLookup = {};
  if (Array.isArray(entityMap)) {
    entityMap.forEach(entity => {
      if (entity.key !== undefined) {
        entityLookup[entity.key] = entity.value;
      }
    });
  }
  
  for (const block of blocks) {
    const blockText = block.text || '';
    const blockType = block.type || 'unstyled';
    
    // 跳过空块
    if (!blockText.trim() && blockType !== 'atomic') {
      continue;
    }
    
    // 处理原子块（通常是媒体或代码块）
    if (blockType === 'atomic') {
      // 从 entityRanges 查找媒体或代码块
      if (block.entityRanges) {
        for (const range of block.entityRanges) {
          const entity = entityLookup[range.key];
          if (entity?.type === 'MEDIA' && entity.data?.mediaItems) {
            // 这里只记录 mediaId，实际图片 URL 需要额外处理
            // fxtwitter 返回的数据中可能有完整 URL
          } else if (entity?.type === 'MARKDOWN' && entity.data?.markdown) {
            // 处理 Markdown 代码块
            const codeHtml = parseMarkdownCodeBlock(entity.data.markdown);
            if (codeHtml) {
              htmlParts.push(codeHtml);
            }
          }
        }
      }
      continue;
    }
    
    // 处理文本块
    textParts.push(blockText);
    
    // 生成 HTML
    let html = escapeHtml(blockText);
    
    // 应用内联样式（粗体等）
    if (block.inlineStyleRanges && block.inlineStyleRanges.length > 0) {
      html = applyInlineStyles(blockText, block.inlineStyleRanges);
    }
    
    // 处理链接
    if (block.entityRanges) {
      for (const range of block.entityRanges) {
        const entity = entityLookup[range.key];
        if (entity?.type === 'LINK' && entity.data?.url) {
          // 简化处理：在文本末尾添加链接
        }
      }
    }
    
    // 处理 data.urls 中的链接
    if (block.data?.urls) {
      for (const urlInfo of block.data.urls) {
        const linkText = urlInfo.text || '';
        if (linkText && html.includes(linkText)) {
          html = html.replace(
            linkText,
            `<a href="${escapeHtml(linkText)}" target="_blank">${escapeHtml(linkText)}</a>`
          );
        }
      }
    }
    
    // 根据块类型包装 HTML
    switch (blockType) {
      case 'header-one':
        html = `<h1>${html}</h1>`;
        break;
      case 'header-two':
        html = `<h2>${html}</h2>`;
        break;
      case 'header-three':
        html = `<h3>${html}</h3>`;
        break;
      case 'blockquote':
        html = `<pre><code>${html}</code></pre>`;
        break;
      case 'unordered-list-item':
        html = `<li>${html}</li>`;
        break;
      case 'ordered-list-item':
        html = `<li>${html}</li>`;
        break;
      default:
        html = `<p>${html}</p>`;
    }
    
    htmlParts.push(html);
  }
  
  // 合并连续的列表项
  const finalHtml = mergeListItems(htmlParts.join('\n'));
  
  return {
    text: textParts.join('\n\n'),
    html: finalHtml,
    images
  };
}

// HTML 转义
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 应用内联样式
function applyInlineStyles(text, styleRanges) {
  // 按 offset 排序
  const sorted = [...styleRanges].sort((a, b) => a.offset - b.offset);
  
  let result = '';
  let lastIndex = 0;
  
  // 简化处理：只处理粗体
  for (const range of sorted) {
    const { offset, length, style } = range;
    
    // 添加前面未处理的文本
    if (offset > lastIndex) {
      result += escapeHtml(text.slice(lastIndex, offset));
    }
    
    const styledText = escapeHtml(text.slice(offset, offset + length));
    
    if (style === 'Bold') {
      result += `<strong>${styledText}</strong>`;
    } else if (style === 'Italic') {
      result += `<em>${styledText}</em>`;
    } else {
      result += styledText;
    }
    
    lastIndex = offset + length;
  }
  
  // 添加剩余文本
  if (lastIndex < text.length) {
    result += escapeHtml(text.slice(lastIndex));
  }
  
  return result;
}

// 合并连续的列表项
function mergeListItems(html) {
  // 将连续的 <li> 包装到 <ul> 中
  return html.replace(
    /(<li>[\s\S]*?<\/li>\n?)+/g,
    match => `<ul>\n${match}</ul>\n`
  );
}

// 解析 Markdown 代码块
function parseMarkdownCodeBlock(markdown) {
  if (!markdown) return '';
  
  // 匹配代码块格式: ```language\ncode\n```
  const codeBlockRegex = /^```(\w+)?\n([\s\S]*?)\n```$/;
  const match = markdown.trim().match(codeBlockRegex);
  
  if (match) {
    const language = match[1] || '';
    const code = match[2];
    const escapedCode = escapeHtml(code);
    
    if (language) {
      return `<pre><code class="language-${language}">${escapedCode}</code></pre>`;
    } else {
      return `<pre><code>${escapedCode}</code></pre>`;
    }
  }
  
  // 如果不是代码块格式，返回转义后的原始内容
  return `<pre>${escapeHtml(markdown)}</pre>`;
}
