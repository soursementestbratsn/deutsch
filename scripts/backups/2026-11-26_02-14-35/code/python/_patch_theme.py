p='web/theme.js'
s=open(p,encoding='utf-8').read()
old='    body.classList.toggle("is-hc-glass", !!u.highContrastGlass);'
new='    body.classList.toggle("is-hc-glass", !!u.highContrastGlass);\n    body.classList.toggle("is-calm", !!u.calmMode);'
assert old in s
s=s.replace(old,new,1)
open(p,'w',encoding='utf-8').write(s)
print('done')
