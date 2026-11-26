p='web/settings.js'
s=open(p,encoding='utf-8').read()
old='        { key: "gamify", type: "toggle", label: "XP, уровни и конфетти", hint: "Выключите — и останется только учёба" }'
new=old+'\n        ,{ key: "calmMode", type: "toggle", label: "Спокойный режим", hint: "Без таймеров, XP и сердечек" }'
assert old in s
s=s.replace(old,new,1)
open(p,'w',encoding='utf-8').write(s)
print('done')
