const escapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};
function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => escapeMap[c]);
}

const baseStyle = 'font-size:12px;line-height:1.6;color:#1D1D1F;word-break:break-all;user-select:text;-webkit-user-select:text;';

function parseInline(text) {
  const codeSpans = [];
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(code);
    return '\x00CODE' + (codeSpans.length - 1) + '\x00';
  });
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:4px 0;display:block;">');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#558B2F;text-decoration:underline;">$1</a>');
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  out = out.replace(/~~(.+?)~~/g, '<del>$1</del>');
  out = out.replace(/\x00CODE(\d+)\x00/g, (_, i) => '<code style="font-family:monospace;background:#F0F0E8;padding:1px 5px;border-radius:4px;font-size:13px;">' + codeSpans[+i] + '</code>');
  return out;
}

function markdownToHtml(md) {
  if (!md) return '';

  const lines = md.split('\n');
  const html = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines = [];
  let buffer = [];
  let inUl = false;
  let inOl = false;

  function flushList() {
    if (inUl) { html.push('</ul>'); inUl = false; }
    if (inOl) { html.push('</ol>'); inOl = false; }
  }

  function flushParagraph() {
    flushList();
    if (buffer.length) {
      html.push('<p style="' + baseStyle + 'margin:0;">' + buffer.join('<br>') + '</p>');
      buffer = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        const escaped = codeBlockLines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html.push('<pre style="background:#F5F5F0;border-radius:8px;padding:10px 12px;overflow-x:auto;font-size:13px;line-height:1.5;margin:2px 0;"><code>' + escaped + '</code></pre>');
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      flushParagraph();
      const m = line.match(/^(#{1,6})\s(.+)/);
      const level = Math.min(m[1].length, 6);
      const sizes = { 1: '22px', 2: '19px', 3: '17px', 4: '15px', 5: '14px', 6: '13px' };
      html.push('<h' + level + ' style="font-size:' + sizes[level] + ';font-weight:bold;color:#3E2723;margin:6px 0 2px;line-height:1.4;">' + parseInline(m[2]) + '</h' + level + '>');
      continue;
    }

    if (/^[-*+]\s/.test(line)) {
      flushList();
      if (!inUl) inUl = true;
      html.push('<ul style="padding-left:16px;margin:0;">');
      html.push('<li style="' + baseStyle + 'margin:0;">' + parseInline(line.replace(/^[-*+]\s/, '')) + '</li>');
      html.push('</ul>');
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      flushList();
      if (!inOl) inOl = true;
      html.push('<ol style="padding-left:16px;margin:0;">');
      html.push('<li style="' + baseStyle + 'margin:0;">' + parseInline(line.replace(/^\d+\.\s/, '')) + '</li>');
      html.push('</ol>');
      continue;
    }

    if (/^>\s/.test(line)) {
      flushParagraph();
      html.push('<blockquote style="border-left:3px solid #A5D6A7;padding:4px 0 4px 10px;margin:2px 0;color:#6D4C41;">' + parseInline(line.replace(/^>\s?/, '')) + '</blockquote>');
      continue;
    }

    if (/^---\s*$/.test(line.trim())) {
      flushParagraph();
      html.push('<hr style="border:none;border-top:1px solid #D7CCC8;margin:4px 0;">');
      continue;
    }

    if (/^\|.+\|$/.test(line) && /^\|[-| :]+\|$/.test(lines[i + 1] || '')) {
      flushParagraph();
      const headerLine = line;
      const alignLine = lines[i + 1];
      const headerCells = headerLine.split('|').filter(c => c.trim());
      const aligns = alignLine.split('|').filter(c => c.trim()).map(c => {
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      let tableHtml = '<table style="border-collapse:collapse;width:100%;margin:2px 0;font-size:13px;">';
      tableHtml += '<thead><tr>';
      headerCells.forEach((cell, ci) => {
        tableHtml += '<th style="border:1px solid #D7CCC8;padding:4px 8px;text-align:' + (aligns[ci] || 'left') + ';background:#F5F5F0;font-weight:bold;">' + parseInline(cell.trim()) + '</th>';
      });
      tableHtml += '</tr></thead><tbody>';
      i += 2;
      while (i < lines.length && lines[i] && /^\|.+\|$/.test(lines[i])) {
        const cells = lines[i].split('|').filter(c => c.trim());
        tableHtml += '<tr>';
        cells.forEach((cell, ci) => {
          tableHtml += '<td style="border:1px solid #D7CCC8;padding:4px 8px;text-align:' + (aligns[ci] || 'left') + ';">' + parseInline(cell.trim()) + '</td>';
        });
        tableHtml += '</tr>';
        i++;
      }
      tableHtml += '</tbody></table>';
      html.push(tableHtml);
      i--;
      continue;
    }

    buffer.push(parseInline(line));
  }

  flushParagraph();
  if (inCodeBlock) {
    const escaped = codeBlockLines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html.push('<pre style="background:#F5F5F0;border-radius:8px;padding:10px 12px;overflow-x:auto;font-size:13px;line-height:1.5;margin:6px 0;"><code>' + escaped + '</code></pre>');
  }

  return html.join('\n');
}

function stripInline(md) {
	  return md
	    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
	    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
	    .replace(/\*\*(.+?)\*\*/g, '$1')
	    .replace(/\*(.+?)\*/g, '$1')
	    .replace(/~~(.+?)~~/g, '$1')
	    .replace(/`([^`]+)`/g, '$1');
	}

	function markdownToPlainText(md) {
	  if (!md) return '';
	  const lines = md.split('\n');
	  const out = [];
	  let inCodeBlock = false;

	  for (let i = 0; i < lines.length; i++) {
	    const line = lines[i];

	    if (line.startsWith('```')) {
	      inCodeBlock = !inCodeBlock;
	      continue;
	    }
	    if (inCodeBlock) {
	      out.push(line);
	      continue;
	    }
	    if (!line.trim()) {
	      out.push('');
	      continue;
	    }
	    if (/^#{1,6}\s/.test(line)) {
	      out.push(line.replace(/^#{1,6}\s/, ''));
	      continue;
	    }
	    if (/^[-*+]\s/.test(line)) {
	      out.push(stripInline(line.replace(/^[-*+]\s/, '')));
	      continue;
	    }
	    if (/^\d+\.\s/.test(line)) {
	      out.push(stripInline(line.replace(/^\d+\.\s/, '')));
	      continue;
	    }
	    if (/^>\s?/.test(line)) {
	      out.push(stripInline(line.replace(/^>\s?/, '')));
	      continue;
	    }
	    if (/^---\s*$/.test(line.trim())) {
	      out.push('────────────────');
	      continue;
	    }
	    if (/^\|.+\|$/.test(line) && /^\|[-| :]+\|$/.test(lines[i + 1] || '')) {
	      i += 2;
	      while (i < lines.length && lines[i] && /^\|.+\|$/.test(lines[i])) {
	        const cells = lines[i].split('|').filter(c => c.trim());
	        out.push(cells.map(c => stripInline(c.trim())).join('  '));
	        i++;
	      }
	      i--;
	      continue;
	    }
	    out.push(stripInline(line));
	  }
	  return out.join('\n');
	}

	module.exports = { markdownToHtml, markdownToPlainText };
