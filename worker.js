/**
 * X Post Grabber - Cloudflare Worker
 * 用于代理获取 X (Twitter) 页面内容，解决跨域问题
 */

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    
    // 获取要抓取的 X 文章 URL
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return jsonResponse({ error: '请提供 url 参数' }, 400);
    }

    // 验证是否是 X/Twitter URL
    if (!isValidXUrl(targetUrl)) {
      return jsonResponse({ error: '请提供有效的 X/Twitter 文章链接' }, 400);
    }

    try {
      // 获取页面内容
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        return jsonResponse({ 
          error: `获取页面失败: ${response.status}`,
          status: response.status 
        }, response.status);
      }

      const html = await response.text();
      
      // 返回 HTML 内容
      return jsonResponse({
        success: true,
        html: html,
        url: targetUrl
      });

    } catch (error) {
      return jsonResponse({ 
        error: '抓取失败: ' + error.message 
      }, 500);
    }
  },
};

// 验证 X/Twitter URL
function isValidXUrl(url) {
  const pattern = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/;
  return pattern.test(url);
}

// JSON 响应工具函数
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
