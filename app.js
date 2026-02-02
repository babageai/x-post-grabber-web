// X Post Grabber - Web Version

document.addEventListener('DOMContentLoaded', function() {
  // 主界面元素
  const mainView = document.getElementById('mainView');
  const settingsView = document.getElementById('settingsView');
  const postUrlInput = document.getElementById('postUrl');
  const grabBtn = document.getElementById('grabBtn');
  const statusDiv = document.getElementById('status');
  const previewSection = document.getElementById('preview');
  const previewContent = document.getElementById('previewContent');
  const copyHtmlBtn = document.getElementById('copyHtmlBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const pushToWpBtn = document.getElementById('pushToWpBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  
  // 设置界面元素
  const workerUrlInput = document.getElementById('workerUrl');
  const wpSiteUrlInput = document.getElementById('wpSiteUrl');
  const wpUsernameInput = document.getElementById('wpUsername');
  const wpAppPasswordInput = document.getElementById('wpAppPassword');
  const wpCategoryInput = document.getElementById('wpCategory');
  const wpEditorTypeSelect = document.getElementById('wpEditorType');
  const aiServiceSelect = document.getElementById('aiService');
  const aiApiKeyInput = document.getElementById('aiApiKey');
  const enableAutoTagsCheckbox = document.getElementById('enableAutoTags');
  const settingsStatusDiv = document.getElementById('settingsStatus');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const backToMainBtn = document.getElementById('backToMainBtn');
  
  // 标签相关元素
  const tagsSection = document.getElementById('tagsSection');
  const tagsContainer = document.getElementById('tagsContainer');

  let currentHtml = '';
  let currentData = null;
  let currentTags = [];

  // ==================== 工具函数 ====================
  
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status show ' + type;
  }

  function hideStatus() {
    statusDiv.className = 'status';
  }

  function showSettingsStatus(message, type) {
    settingsStatusDiv.textContent = message;
    settingsStatusDiv.className = 'status show ' + type;
    
    if (type === 'success') {
      setTimeout(() => {
        hideSettingsStatus();
      }, 3000);
    }
  }

  function hideSettingsStatus() {
    settingsStatusDiv.className = 'status';
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function isValidXUrl(url) {
    const pattern = /^https?:\/\/(x\.com|twitter\.com)\/\w+\/status\/\d+/;
    return pattern.test(url);
  }

  // ==================== 存储函数 ====================
  
  function loadSettings() {
    const settings = localStorage.getItem('xPostGrabberSettings');
    return settings ? JSON.parse(settings) : {};
  }

  function saveSettings(settings) {
    const existing = loadSettings();
    const merged = { ...existing, ...settings };
    localStorage.setItem('xPostGrabberSettings', JSON.stringify(merged));
  }

  // ==================== WordPress 相关函数 ====================
  
  function base64Encode(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary);
  }

  async function testWpConnection(siteUrl, username, appPassword) {
    const cleanPassword = appPassword.replace(/\s+/g, '');
    const apiUrl = `${siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/users/me`;
    const authString = base64Encode(`${username}:${cleanPassword}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + authString,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`连接失败 (${response.status}): ${responseText}`);
    }
    
    return response.json();
  }

  async function pushToWordPress(title, content, categoryId, tags = []) {
    const settings = loadSettings();
    
    if (!settings.wpSiteUrl || !settings.wpUsername || !settings.wpAppPassword) {
      throw new Error('请先配置 WordPress 设置');
    }
    
    const cleanPassword = settings.wpAppPassword.replace(/\s+/g, '');
    const apiUrl = `${settings.wpSiteUrl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;
    const authString = base64Encode(`${settings.wpUsername}:${cleanPassword}`);
    
    const postData = {
      title: title,
      content: content,
      status: 'draft'
    };
    
    const catId = categoryId || settings.wpCategory;
    if (catId) {
      postData.categories = [parseInt(catId)];
    }
    
    if (tags && tags.length > 0) {
      const tagIds = await getOrCreateTags(tags, settings);
      if (tagIds.length > 0) {
        postData.tags = tagIds;
      }
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + authString,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });
    
    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`推送失败 (${response.status}): ${responseText}`);
    }
    
    return response.json();
  }
  
  async function getOrCreateTags(tagNames, settings) {
    const cleanPassword = settings.wpAppPassword.replace(/\s+/g, '');
    const baseUrl = settings.wpSiteUrl.replace(/\/$/, '');
    const authString = base64Encode(`${settings.wpUsername}:${cleanPassword}`);
    
    const tagIds = [];
    
    for (const tagName of tagNames) {
      try {
        const searchUrl = `${baseUrl}/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}`;
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'Authorization': 'Basic ' + authString
          }
        });
        
        if (searchResponse.ok) {
          const existingTags = await searchResponse.json();
          const exactMatch = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          
          if (exactMatch) {
            tagIds.push(exactMatch.id);
          } else {
            const createUrl = `${baseUrl}/wp-json/wp/v2/tags`;
            const createResponse = await fetch(createUrl, {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + authString,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ name: tagName })
            });
            
            if (createResponse.ok) {
              const newTag = await createResponse.json();
              tagIds.push(newTag.id);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing tag "${tagName}":`, error);
      }
    }
    
    return tagIds;
  }

  // ==================== 内容生成函数 ====================

  function generatePostTitle(data) {
    if (data.articleTitle) {
      return data.articleTitle;
    }
    const textPreview = data.textContent.text.substring(0, 50).replace(/\n/g, ' ');
    return `${data.userInfo.name}: ${textPreview}...`;
  }

  function generatePostContent(data, editorType) {
    if (editorType === 'gutenberg') {
      return generateGutenbergContent(data);
    } else {
      return generateClassicContent(data);
    }
  }

  function generateGutenbergContent(data) {
    let content = '';
    
    const textHtml = data.textContent.html || `<p>${escapeHtml(data.textContent.text)}</p>`;
    content += convertHtmlToGutenbergBlocks(textHtml);
    
    if (data.mediaContent && data.mediaContent.images && data.mediaContent.images.length > 0) {
      data.mediaContent.images.forEach(img => {
        content += `<!-- wp:image -->\n`;
        content += `<figure class="wp-block-image"><img src="${img.src}" alt="${img.alt || ''}"/></figure>\n`;
        content += `<!-- /wp:image -->\n\n`;
      });
    }
    
    content += `<!-- wp:group {"className":"x-post-meta"} -->\n`;
    content += `<div class="wp-block-group x-post-meta">\n`;
    content += `<!-- wp:paragraph -->\n`;
    content += `<p><strong>作者：</strong>${escapeHtml(data.userInfo.name)} (${escapeHtml(data.userInfo.username)})</p>\n`;
    content += `<!-- /wp:paragraph -->\n\n`;
    content += `<!-- wp:paragraph -->\n`;
    content += `<p><strong>时间：</strong>${escapeHtml(data.timeInfo.displayText)}</p>\n`;
    content += `<!-- /wp:paragraph -->\n`;
    content += `</div>\n<!-- /wp:group -->\n\n`;
    
    return content;
  }

  function convertHtmlToGutenbergBlocks(html) {
    let content = '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    function processParagraphContent(innerHTML) {
      let result = '';
      const tempP = document.createElement('div');
      tempP.innerHTML = innerHTML;
      
      const imgs = tempP.querySelectorAll('img');
      const hasImages = imgs.length > 0;
      
      if (hasImages && tempP.textContent.trim() === '') {
        imgs.forEach(img => {
          result += `<!-- wp:image -->\n`;
          result += `<figure class="wp-block-image"><img src="${img.src}" alt="${img.alt || ''}"/></figure>\n`;
          result += `<!-- /wp:image -->\n\n`;
        });
        return result;
      }
      
      let currentParagraph = '';
      
      function flushParagraph() {
        const trimmed = currentParagraph.trim();
        if (trimmed) {
          result += `<!-- wp:paragraph -->\n<p>${trimmed}</p>\n<!-- /wp:paragraph -->\n\n`;
        }
        currentParagraph = '';
      }
      
      function walkNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          if (text.includes('\n')) {
            const parts = text.split('\n');
            for (let i = 0; i < parts.length; i++) {
              currentParagraph += parts[i];
              if (i < parts.length - 1) {
                flushParagraph();
              }
            }
          } else {
            currentParagraph += text;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();
          
          if (tagName === 'br') {
            flushParagraph();
          } else if (tagName === 'img') {
            flushParagraph();
            result += `<!-- wp:image -->\n`;
            result += `<figure class="wp-block-image"><img src="${node.src}" alt="${node.alt || ''}"/></figure>\n`;
            result += `<!-- /wp:image -->\n\n`;
          } else if (tagName === 'figure') {
            flushParagraph();
            const img = node.querySelector('img');
            if (img) {
              result += `<!-- wp:image -->\n`;
              result += `<figure class="wp-block-image"><img src="${img.src}" alt="${img.alt || ''}"/></figure>\n`;
              result += `<!-- /wp:image -->\n\n`;
            }
          } else if (tagName === 'strong' || tagName === 'b') {
            currentParagraph += `<strong>${node.innerHTML}</strong>`;
          } else if (tagName === 'em' || tagName === 'i') {
            currentParagraph += `<em>${node.innerHTML}</em>`;
          } else if (tagName === 'a') {
            currentParagraph += `<a href="${node.getAttribute('href') || ''}">${node.innerHTML}</a>`;
          } else if (tagName === 'code') {
            currentParagraph += `<code>${node.innerHTML}</code>`;
          } else {
            for (const child of node.childNodes) {
              walkNodes(child);
            }
          }
        }
      }
      
      for (const child of tempP.childNodes) {
        walkNodes(child);
      }
      
      flushParagraph();
      return result;
    }
    
    function processNode(node) {
      let result = '';
      
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          const lines = text.split(/\n+/);
          lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              result += `<!-- wp:paragraph -->\n<p>${escapeHtml(trimmedLine)}</p>\n<!-- /wp:paragraph -->\n\n`;
            }
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        if (tagName === 'p') {
          result += processParagraphContent(node.innerHTML);
        } else if (tagName === 'ol') {
          result += `<!-- wp:list {"ordered":true} -->\n<ol class="wp-block-list">`;
          const listItems = node.querySelectorAll(':scope > li');
          listItems.forEach(li => {
            result += `<li>${li.innerHTML}</li>`;
          });
          result += `</ol>\n<!-- /wp:list -->\n\n`;
        } else if (tagName === 'ul') {
          result += `<!-- wp:list -->\n<ul class="wp-block-list">`;
          const listItems = node.querySelectorAll(':scope > li');
          listItems.forEach(li => {
            result += `<li>${li.innerHTML}</li>`;
          });
          result += `</ul>\n<!-- /wp:list -->\n\n`;
        } else if (tagName === 'figure') {
          const img = node.querySelector('img');
          if (img) {
            result += `<!-- wp:image -->\n`;
            result += `<figure class="wp-block-image"><img src="${img.src}" alt="${img.alt || ''}"/></figure>\n`;
            result += `<!-- /wp:image -->\n\n`;
          }
        } else if (tagName === 'img') {
          result += `<!-- wp:image -->\n`;
          result += `<figure class="wp-block-image"><img src="${node.src}" alt="${node.alt || ''}"/></figure>\n`;
          result += `<!-- /wp:image -->\n\n`;
        } else if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
          const level = tagName.charAt(1);
          result += `<!-- wp:heading {"level":${level}} -->\n<${tagName}>${node.innerHTML}</${tagName}>\n<!-- /wp:heading -->\n\n`;
        } else if (tagName === 'pre') {
          const codeEl = node.querySelector('code');
          const codeContent = codeEl ? codeEl.textContent : node.textContent;
          result += `<!-- wp:code -->\n<pre class="wp-block-code"><code>${escapeHtml(codeContent)}</code></pre>\n<!-- /wp:code -->\n\n`;
        } else if (tagName === 'div') {
          for (const child of node.childNodes) {
            result += processNode(child);
          }
        } else {
          if (node.childNodes.length > 0) {
            for (const child of node.childNodes) {
              result += processNode(child);
            }
          }
        }
      }
      
      return result;
    }
    
    for (const node of temp.childNodes) {
      content += processNode(node);
    }
    
    return content;
  }

  function generateClassicContent(data) {
    let content = '';
    
    content += `<div class="x-post-content">\n`;
    content += data.textContent.html || `<p>${escapeHtml(data.textContent.text)}</p>`;
    content += `\n</div>\n\n`;
    
    if (data.mediaContent && data.mediaContent.images && data.mediaContent.images.length > 0) {
      content += `<div class="x-post-media">\n`;
      data.mediaContent.images.forEach(img => {
        content += `<figure><img src="${img.src}" alt="${img.alt || ''}" style="max-width:100%;"/></figure>\n`;
      });
      content += `</div>\n\n`;
    }
    
    content += `<div class="x-post-meta">\n`;
    content += `<p><strong>作者：</strong>${escapeHtml(data.userInfo.name)} (${escapeHtml(data.userInfo.username)})</p>\n`;
    content += `<p><strong>时间：</strong>${escapeHtml(data.timeInfo.displayText)}</p>\n`;
    content += `</div>`;
    
    return content;
  }

  // ==================== AI 标签生成 ====================
  
  const AI_SERVICES = {
    siliconflow: {
      name: '硅基流动',
      apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
      model: 'Qwen/Qwen2.5-7B-Instruct',
      authHeader: (key) => `Bearer ${key}`,
      buildRequest: (prompt, model) => ({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      }),
      parseResponse: (data) => data.choices[0].message.content
    },
    deepseek: {
      name: 'DeepSeek',
      apiUrl: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
      authHeader: (key) => `Bearer ${key}`,
      buildRequest: (prompt, model) => ({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      }),
      parseResponse: (data) => data.choices[0].message.content
    },
    groq: {
      name: 'Groq',
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'llama-3.1-8b-instant',
      authHeader: (key) => `Bearer ${key}`,
      buildRequest: (prompt, model) => ({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      }),
      parseResponse: (data) => data.choices[0].message.content
    },
    dashscope: {
      name: '阿里百炼',
      apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model: 'qwen-turbo',
      authHeader: (key) => `Bearer ${key}`,
      buildRequest: (prompt, model) => ({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      }),
      parseResponse: (data) => data.choices[0].message.content
    },
    openai: {
      name: 'OpenAI',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',
      authHeader: (key) => `Bearer ${key}`,
      buildRequest: (prompt, model) => ({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      }),
      parseResponse: (data) => data.choices[0].message.content
    },
    claude: {
      name: 'Claude',
      apiUrl: 'https://api.anthropic.com/v1/messages',
      model: 'claude-3-haiku-20240307',
      authHeader: (key) => key,
      extraHeaders: {
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      buildRequest: (prompt, model) => ({
        model: model,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      }),
      parseResponse: (data) => data.content[0].text
    },
    kimi: {
      name: 'Kimi',
      apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
      model: 'moonshot-v1-8k',
      authHeader: (key) => `Bearer ${key}`,
      buildRequest: (prompt, model) => ({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      }),
      parseResponse: (data) => data.choices[0].message.content
    },
    glm: {
      name: 'GLM',
      apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      model: 'glm-4-flash',
      authHeader: (key) => `Bearer ${key}`,
      buildRequest: (prompt, model) => ({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      }),
      parseResponse: (data) => data.choices[0].message.content
    },
    minimax: {
      name: 'MiniMax',
      apiUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
      model: 'abab6.5s-chat',
      authHeader: (key) => `Bearer ${key}`,
      buildRequest: (prompt, model) => ({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.7
      }),
      parseResponse: (data) => data.choices[0].message.content
    }
  };
  
  function buildTagPrompt(title, content) {
    const truncatedContent = content.substring(0, 500);
    return `根据以下文章标题和内容，生成3个简短的中文标签（每个2-4个字）。
只返回标签，用逗号分隔，不要有其他内容。

标题：${title}
内容：${truncatedContent}`;
  }
  
  async function generateTagsWithAI(title, content) {
    const settings = loadSettings();
    
    if (!settings.aiService || !settings.aiApiKey) {
      throw new Error('请先配置 AI 服务和 API Key');
    }
    
    const service = AI_SERVICES[settings.aiService];
    if (!service) {
      throw new Error('未知的 AI 服务');
    }
    
    const prompt = buildTagPrompt(title, content);
    const requestBody = service.buildRequest(prompt, service.model);
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (settings.aiService === 'claude') {
      headers['x-api-key'] = service.authHeader(settings.aiApiKey);
    } else {
      headers['Authorization'] = service.authHeader(settings.aiApiKey);
    }
    
    if (service.extraHeaders) {
      Object.assign(headers, service.extraHeaders);
    }
    
    const response = await fetch(service.apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI 服务请求失败 (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    const tagsText = service.parseResponse(data);
    
    const tags = tagsText
      .split(/[,，、]/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0 && tag.length <= 10);
    
    return tags.slice(0, 5);
  }
  
  function renderTags() {
    tagsContainer.innerHTML = '';
    
    if (currentTags.length === 0) {
      tagsContainer.innerHTML = '<span class="tags-loading">暂无标签</span>';
      return;
    }
    
    currentTags.forEach((tag) => {
      const tagEl = document.createElement('span');
      tagEl.className = 'tag-item';
      tagEl.textContent = tag;
      tagsContainer.appendChild(tagEl);
    });
  }

  // ==================== 内容提取 ====================
  
  function extractPostFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const result = {
      userInfo: { name: '', username: '', avatarUrl: '' },
      textContent: { text: '', html: '', isArticle: false },
      mediaContent: { images: [], videos: [], html: '' },
      timeInfo: { datetime: '', displayText: '' },
      articleTitle: null
    };
    
    try {
      // 尝试提取文章标题
      const titleEl = doc.querySelector('[data-testid="twitter-article-title"]');
      if (titleEl) {
        result.articleTitle = titleEl.textContent.trim();
      }
      
      // 检查是否是长文章格式
      const articleRichText = doc.querySelector('[data-testid="twitterArticleRichTextView"]');
      
      if (articleRichText) {
        result.textContent.isArticle = true;
        extractArticleContent(articleRichText, result);
      } else {
        // 普通推文
        const article = doc.querySelector('article[data-testid="tweet"]');
        if (article) {
          extractNormalTweet(article, result);
        }
      }
      
      // 提取用户信息
      extractUserInfo(doc, result);
      
      // 提取时间
      extractTimeInfo(doc, result);
      
    } catch (e) {
      console.error('解析 HTML 失败:', e);
    }
    
    return result;
  }
  
  function extractUserInfo(doc, result) {
    try {
      const userNameEl = doc.querySelector('[data-testid="User-Name"]');
      if (userNameEl) {
        const spans = userNameEl.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent.trim();
          if (text && !text.startsWith('@') && text.length > 0 && !result.userInfo.name) {
            result.userInfo.name = text;
          }
          if (text.startsWith('@')) {
            result.userInfo.username = text;
          }
        }
      }
      
      const avatarImg = doc.querySelector('img[src*="profile_images"]');
      if (avatarImg) {
        result.userInfo.avatarUrl = avatarImg.src;
      }
    } catch (e) {
      console.error('提取用户信息失败:', e);
    }
  }
  
  function extractTimeInfo(doc, result) {
    try {
      const timeEl = doc.querySelector('time');
      if (timeEl) {
        result.timeInfo.datetime = timeEl.getAttribute('datetime') || '';
        result.timeInfo.displayText = timeEl.textContent || '';
        
        if (result.timeInfo.datetime) {
          const date = new Date(result.timeInfo.datetime);
          result.timeInfo.displayText = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      }
    } catch (e) {
      console.error('提取时间失败:', e);
    }
  }
  
  function extractNormalTweet(article, result) {
    try {
      const tweetText = article.querySelector('[data-testid="tweetText"]');
      if (tweetText) {
        result.textContent.text = tweetText.textContent;
        result.textContent.html = processHtml(tweetText.innerHTML);
      }
      
      // 提取图片
      const images = article.querySelectorAll('[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]');
      const addedSrcs = new Set();
      images.forEach(img => {
        let src = img.src;
        if (!src || addedSrcs.has(src)) return;
        
        if (src.includes('pbs.twimg.com/media')) {
          src = src.replace(/[?&]name=\w+/, '');
          if (src.includes('?')) {
            src += '&name=large';
          } else {
            src += '?format=jpg&name=large';
          }
        }
        
        addedSrcs.add(img.src);
        addedSrcs.add(src);
        
        result.mediaContent.images.push({
          src: src,
          alt: img.alt || ''
        });
      });
    } catch (e) {
      console.error('提取普通推文失败:', e);
    }
  }
  
  function extractArticleContent(articleElement, result) {
    try {
      const blocks = articleElement.querySelectorAll('[data-block="true"]');
      let htmlParts = [];
      let textParts = [];
      const addedImageSrcs = new Set();
      
      blocks.forEach(block => {
        // 检查图片
        const imageElement = block.querySelector('[data-testid="tweetPhoto"] img') || 
                             block.querySelector('img[src*="pbs.twimg.com/media"]');
        
        if (imageElement) {
          let src = imageElement.src;
          if (src && !addedImageSrcs.has(src)) {
            if (src.includes('pbs.twimg.com/media')) {
              src = src.replace(/[?&]name=\w+/, '');
              if (src.includes('?')) {
                src += '&name=large';
              } else {
                src += '?format=jpg&name=large';
              }
            }
            addedImageSrcs.add(imageElement.src);
            addedImageSrcs.add(src);
            htmlParts.push(`<figure class="x-post-image"><img src="${src}" alt="${imageElement.alt || ''}"/></figure>`);
            textParts.push('[图片]');
          }
          return;
        }
        
        // 检查代码块
        const codeElement = block.querySelector('code');
        if (codeElement) {
          const codeText = codeElement.textContent;
          htmlParts.push(`<pre><code>${escapeHtml(codeText)}</code></pre>`);
          textParts.push(codeText);
          return;
        }
        
        // 检查标题
        let headingLevel = 0;
        if (block.classList.contains('longform-header-one')) {
          headingLevel = 1;
        } else if (block.classList.contains('longform-header-two')) {
          headingLevel = 2;
        } else if (block.classList.contains('longform-header-three')) {
          headingLevel = 3;
        }
        
        // 检查列表项
        const isListItem = block.classList.contains('longform-ordered-list-item');
        
        // 提取文本
        const textSpans = block.querySelectorAll('span[data-text="true"]');
        let blockText = '';
        let blockHtml = '';
        
        textSpans.forEach(span => {
          const text = span.textContent;
          blockText += text;
          
          const parentStyle = span.parentElement?.getAttribute('style') || '';
          const isBold = parentStyle.includes('font-weight: bold');
          
          const codeParent = span.closest('code');
          if (codeParent) {
            blockHtml += `<code>${escapeHtml(text)}</code>`;
            return;
          }
          
          const linkParent = span.closest('a');
          if (linkParent) {
            let href = linkParent.getAttribute('href') || '';
            if (href.startsWith('//')) {
              href = 'https:' + href;
            } else if (href.startsWith('/')) {
              href = 'https://x.com' + href;
            }
            blockHtml += `<a href="${href}">${escapeHtml(text)}</a>`;
          } else if (isBold) {
            blockHtml += `<strong>${escapeHtml(text)}</strong>`;
          } else {
            blockHtml += escapeHtml(text);
          }
        });
        
        if (blockText.trim()) {
          textParts.push(blockText);
          
          if (headingLevel > 0) {
            htmlParts.push(`<h${headingLevel}>${blockHtml}</h${headingLevel}>`);
          } else if (isListItem) {
            htmlParts.push(`<!--LIST_ITEM--><li>${blockHtml}</li>`);
          } else {
            htmlParts.push(`<p>${blockHtml}</p>`);
          }
        }
      });
      
      // 处理列表
      let finalHtml = '';
      let inList = false;
      htmlParts.forEach(part => {
        if (part.startsWith('<!--LIST_ITEM-->')) {
          const liContent = part.replace('<!--LIST_ITEM-->', '');
          if (!inList) {
            finalHtml += '<ol>\n';
            inList = true;
          }
          finalHtml += liContent + '\n';
        } else {
          if (inList) {
            finalHtml += '</ol>\n';
            inList = false;
          }
          finalHtml += part + '\n';
        }
      });
      if (inList) {
        finalHtml += '</ol>\n';
      }
      
      result.textContent.text = textParts.join('\n\n');
      result.textContent.html = finalHtml;
      
    } catch (e) {
      console.error('提取长文章内容失败:', e);
    }
  }
  
  function processHtml(html) {
    if (!html) return '';
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    const links = temp.querySelectorAll('a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      const text = link.innerHTML;
      link.innerHTML = '';
      Array.from(link.attributes).forEach(attr => link.removeAttribute(attr.name));
      if (href) {
        if (href.startsWith('/')) {
          link.setAttribute('href', 'https://x.com' + href);
        } else {
          link.setAttribute('href', href);
        }
      }
      link.innerHTML = text;
    });
    
    const spans = temp.querySelectorAll('span');
    spans.forEach(span => {
      Array.from(span.attributes).forEach(attr => span.removeAttribute(attr.name));
    });
    
    return temp.innerHTML;
  }

  // ==================== 界面切换 ====================
  
  function showSettingsView() {
    const settings = loadSettings();
    workerUrlInput.value = settings.workerUrl || '';
    wpSiteUrlInput.value = settings.wpSiteUrl || '';
    wpUsernameInput.value = settings.wpUsername || '';
    wpAppPasswordInput.value = settings.wpAppPassword || '';
    wpCategoryInput.value = settings.wpCategory || '';
    wpEditorTypeSelect.value = settings.wpEditorType || 'gutenberg';
    aiServiceSelect.value = settings.aiService || 'siliconflow';
    aiApiKeyInput.value = settings.aiApiKey || '';
    enableAutoTagsCheckbox.checked = settings.enableAutoTags !== false;
    
    mainView.style.display = 'none';
    settingsView.style.display = 'block';
  }

  function showMainView() {
    settingsView.style.display = 'none';
    mainView.style.display = 'block';
  }

  // ==================== 显示预览 ====================
  
  async function showPreview(data, autoGenerateTags = true) {
    currentHtml = buildHtmlOutput(data);
    currentData = data;
    currentTags = [];
    
    let previewHtml = `
      <div class="x-post">
        <div class="x-post-header">
          ${data.userInfo.avatarUrl ? `<img class="x-post-avatar" src="${data.userInfo.avatarUrl}" style="width:40px;height:40px;border-radius:50%;margin-right:10px;">` : ''}
          <div class="x-post-author">
            <strong>${escapeHtml(data.userInfo.name)}</strong>
            <span style="color:#536471;font-size:13px;">${escapeHtml(data.userInfo.username)}</span>
          </div>
        </div>
        <div class="x-post-text" style="margin:12px 0;">${data.textContent.html || escapeHtml(data.textContent.text)}</div>
    `;

    if (data.mediaContent && data.mediaContent.images && data.mediaContent.images.length > 0) {
      previewHtml += '<div class="x-post-media">';
      data.mediaContent.images.forEach(img => {
        previewHtml += `<img src="${img.src}" style="max-width:100%;border-radius:8px;margin:4px 0;">`;
      });
      previewHtml += '</div>';
    }

    previewHtml += `
        <div class="x-post-time" style="color:#536471;font-size:13px;margin-top:12px;">${escapeHtml(data.timeInfo.displayText)}</div>
      </div>
    `;

    previewContent.innerHTML = previewHtml;
    previewSection.style.display = 'block';
    
    tagsSection.style.display = 'block';
    tagsContainer.innerHTML = '<span class="tags-loading">正在生成标签...</span>';
    
    if (autoGenerateTags) {
      const settings = loadSettings();
      if (settings.enableAutoTags !== false && settings.aiApiKey) {
        try {
          const title = generatePostTitle(data);
          const content = data.textContent.text;
          const tags = await generateTagsWithAI(title, content);
          currentTags = tags;
          renderTags();
        } catch (error) {
          console.error('Auto tag generation failed:', error);
          tagsContainer.innerHTML = `<span class="tags-loading">标签生成失败: ${error.message}</span>`;
        }
      } else {
        tagsContainer.innerHTML = '<span class="tags-loading">未配置 AI 服务</span>';
      }
    } else {
      renderTags();
    }
  }
  
  function buildHtmlOutput(data) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>X Post - ${data.userInfo.name || data.userInfo.username}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #0f1419; padding: 20px; max-width: 600px; margin: 0 auto; }
    .x-post { border: 1px solid #eff3f4; border-radius: 16px; padding: 16px; }
    .x-post-header { display: flex; align-items: center; margin-bottom: 12px; }
    .x-post-avatar { width: 48px; height: 48px; border-radius: 50%; margin-right: 12px; }
    .x-post-text { font-size: 15px; line-height: 1.5; margin-bottom: 12px; white-space: pre-wrap; }
    .x-post-text a { color: #1d9bf0; text-decoration: none; }
    .x-post-media img { max-width: 100%; border-radius: 16px; margin: 4px 0; }
    .x-post-time { color: #536471; font-size: 14px; margin-top: 12px; }
    pre { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow-x: auto; }
    code { font-family: monospace; }
  </style>
</head>
<body>
  <div class="x-post">
    <div class="x-post-header">
      ${data.userInfo.avatarUrl ? `<img class="x-post-avatar" src="${data.userInfo.avatarUrl}" alt="">` : ''}
      <div>
        <div style="font-weight:700;">${escapeHtml(data.userInfo.name)}</div>
        <div style="color:#536471;font-size:14px;">${escapeHtml(data.userInfo.username)}</div>
      </div>
    </div>
    <div class="x-post-text">${data.textContent.html || escapeHtml(data.textContent.text)}</div>
    ${data.mediaContent.images.map(img => `<div class="x-post-media"><img src="${img.src}" alt="${img.alt}"></div>`).join('')}
    <div class="x-post-time">${escapeHtml(data.timeInfo.displayText)}</div>
  </div>
</body>
</html>`;
  }

  // ==================== 事件监听器 ====================

  settingsBtn.addEventListener('click', showSettingsView);
  backToMainBtn.addEventListener('click', showMainView);

  saveSettingsBtn.addEventListener('click', function() {
    const settings = {
      workerUrl: workerUrlInput.value.trim(),
      wpSiteUrl: wpSiteUrlInput.value.trim(),
      wpUsername: wpUsernameInput.value.trim(),
      wpAppPassword: wpAppPasswordInput.value.trim(),
      wpCategory: wpCategoryInput.value.trim(),
      wpEditorType: wpEditorTypeSelect.value,
      aiService: aiServiceSelect.value,
      aiApiKey: aiApiKeyInput.value.trim(),
      enableAutoTags: enableAutoTagsCheckbox.checked
    };
    
    saveSettings(settings);
    showSettingsStatus('设置已保存', 'success');
  });

  testConnectionBtn.addEventListener('click', async function() {
    const siteUrl = wpSiteUrlInput.value.trim();
    const username = wpUsernameInput.value.trim();
    const appPassword = wpAppPasswordInput.value.trim();
    
    if (!siteUrl || !username || !appPassword) {
      showSettingsStatus('请填写网站地址、用户名和应用密码', 'error');
      return;
    }
    
    testConnectionBtn.disabled = true;
    showSettingsStatus('正在测试连接...', 'loading');
    
    try {
      const user = await testWpConnection(siteUrl, username, appPassword);
      showSettingsStatus(`连接成功！当前用户: ${user.name}`, 'success');
    } catch (error) {
      showSettingsStatus('连接失败: ' + error.message, 'error');
    } finally {
      testConnectionBtn.disabled = false;
    }
  });

  grabBtn.addEventListener('click', async function() {
    const url = postUrlInput.value.trim();
    
    if (!url) {
      showStatus('请输入文章链接', 'error');
      return;
    }

    if (!isValidXUrl(url)) {
      showStatus('请输入有效的 X/Twitter 文章链接', 'error');
      return;
    }
    
    const settings = loadSettings();
    if (!settings.workerUrl) {
      showStatus('请先在设置中配置 Cloudflare Worker URL', 'error');
      return;
    }

    grabBtn.disabled = true;
    showStatus('正在抓取内容...', 'loading');

    try {
      const workerUrl = `${settings.workerUrl}?url=${encodeURIComponent(url)}`;
      const response = await fetch(workerUrl);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '抓取失败');
      }
      
      const data = extractPostFromHtml(result.html);
      showStatus('提取成功！', 'success');
      showPreview(data);
    } catch (error) {
      showStatus('错误: ' + error.message, 'error');
    } finally {
      grabBtn.disabled = false;
    }
  });

  copyHtmlBtn.addEventListener('click', async function() {
    if (!currentHtml) return;
    
    try {
      await navigator.clipboard.writeText(currentHtml);
      showStatus('HTML 已复制到剪贴板', 'success');
    } catch (error) {
      showStatus('复制失败: ' + error.message, 'error');
    }
  });

  downloadBtn.addEventListener('click', function() {
    if (!currentHtml) return;
    
    const blob = new Blob([currentHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const filename = `x-post-${timestamp}.html`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showStatus('已下载', 'success');
  });

  pushToWpBtn.addEventListener('click', async function() {
    if (!currentData) {
      showStatus('请先抓取内容', 'error');
      return;
    }
    
    pushToWpBtn.disabled = true;
    showStatus('正在推送到 WordPress...', 'loading');
    
    try {
      const settings = loadSettings();
      const editorType = settings.wpEditorType || 'gutenberg';
      const title = generatePostTitle(currentData);
      const content = generatePostContent(currentData, editorType);
      const result = await pushToWordPress(title, content, null, currentTags);
      
      const editorName = editorType === 'gutenberg' ? '区块编辑器' : '经典编辑器';
      const tagsInfo = currentTags.length > 0 ? `，标签: ${currentTags.join(', ')}` : '';
      showStatus(`推送成功！文章 ID: ${result.id}，已保存为草稿 (${editorName}格式)${tagsInfo}`, 'success');
    } catch (error) {
      showStatus('推送失败: ' + error.message, 'error');
    } finally {
      pushToWpBtn.disabled = false;
    }
  });

  // 初始化：加载设置
  const settings = loadSettings();
  if (settings.aiService) {
    aiServiceSelect.value = settings.aiService;
  }
});
