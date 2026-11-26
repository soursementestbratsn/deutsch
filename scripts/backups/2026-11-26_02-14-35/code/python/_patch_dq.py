p='web/dq.js'
s=open(p,encoding='utf-8').read()
anchor='/** Совпал ли ввод хотя бы с одним вариантом ответа'
func='''/** Посимвольный дифф ответа: возвращает HTML с подсвеченными различиями. */
function diffAnswer(user, expected) {
  const u = String(user||''), e = String(expected||'');
  const n = Math.max(u.length, e.length);
  let html = '';
  for (let i=0; i<n; i++) {
    const uc = u[i]||'', ec = e[i]||'';
    if (uc === ec) { html += '<span class="diff-ok">'+(ec||'')+'</span>'; }
    else if (!uc) { html += '<span class="diff-miss">'+ec+'</span>'; }
    else if (!ec) { html += '<span class="diff-extra">'+uc+'</span>'; }
    else { html += '<span class="diff-wrong">'+ec+'</span>'; }
  }
  return html;
}

'''
s=s.replace(anchor, func+anchor, 1)
open(p,'w',encoding='utf-8').write(s)
print('done')
