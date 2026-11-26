Fixed:
1. Beautiful admin panel (web/admin.html) with dark theme, stats cards, user table, detail panels
2. Added TTS prefetch endpoint (/api/tts/prefetch) - triggers background neural voice generation
3. Fixed voiceVariant saving in handle_save (added voiceGender, voiceVariant to allowed fields)
4. Added legacy stats migration in _load_user_stats - old stats now migrate to per-user files
5. All 3 German neural voices work: standard (DE), Austria (AT), Swiss (CH) + Russian
6. Admin launch scripts (launch_admin.py, Launch-Admin.ps1) work with one command

TTS is now live neural voices with proper intonation, German accents, SSML prosody.
