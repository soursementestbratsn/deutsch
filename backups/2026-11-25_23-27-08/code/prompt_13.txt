Fixed:
1. /api/pairs 502 error - added enabled_groups and enabled_words to DEFAULT_STATS
2. Removed 'Версии' button from public access (index.html + style.css)
3. Added admin endpoints: /api/admin/users and /api/admin/user/<id>
4. Added /api/tr/add endpoint for adding custom words
5. Added 'Add Word' button and modal to My Words screen
6. Fixed settings close on mobile - added backdrop element and click handler
7. Fixed charts not rendering on tab switch - re-render charts when mobile stats tabs are switched
8. Fixed mobile.css border-radius conflict with glass.css
