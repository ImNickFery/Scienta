module.exports=[453153,e=>{"use strict";let a=["fa","en"];e.s(["b",0,function(e){return a.includes(e)},"V",0,a])},201590,e=>{"use strict";var a=e.i(347540),n=e.i(843793);let t="(a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND a.scheduled_at <= NOW()))",l=(0,a.cache)(async()=>(await (0,n.query)(`SELECT f.slug, f.name_fa, f.name_en, f.color, f.icon,
            COUNT(a.id) AS article_count
     FROM fields f
     LEFT JOIN articles a
       ON a.field_id = f.id
      AND ${t}
      AND a.deleted_at IS NULL
     WHERE f.deleted_at IS NULL
     GROUP BY f.id, f.slug, f.name_fa, f.name_en, f.color, f.icon, f.sort_order
     ORDER BY f.sort_order ASC`)).map(e=>({slug:e.slug,name:{fa:e.name_fa,en:e.name_en},color:e.color,icon:e.icon,articleCount:Number(e.article_count??0)}))),i=(0,a.cache)(async e=>{let a=await (0,n.queryOne)(`SELECT f.slug, f.name_fa, f.name_en, f.color, f.icon,
            COUNT(a.id) AS article_count
     FROM fields f
     LEFT JOIN articles a
       ON a.field_id = f.id
      AND ${t}
      AND a.deleted_at IS NULL
     WHERE f.slug = ? AND f.deleted_at IS NULL
     GROUP BY f.id, f.slug, f.name_fa, f.name_en, f.color, f.icon
     LIMIT 1`,[e]);return a?{slug:a.slug,name:{fa:a.name_fa,en:a.name_en},color:a.color,icon:a.icon,articleCount:Number(a.article_count??0)}:null});function f(e){return{slug:e.slug,name:{fa:e.name_fa,en:e.name_en},title:{fa:e.title_fa??"",en:e.title_en??""},bio:{fa:e.bio_fa??"",en:e.bio_en??""},avatar:e.avatar_url??"",social:function(e){if(e)try{let a=JSON.parse(e);if(!a||"object"!=typeof a||Array.isArray(a))return;return a}catch{return}}(e.social_json)}}let r=(0,a.cache)(async()=>(await (0,n.query)(`SELECT slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en, avatar_url, social_json
     FROM authors WHERE deleted_at IS NULL ORDER BY name_en ASC`)).map(f));(0,a.cache)(async e=>{let a=await (0,n.queryOne)(`SELECT slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en, avatar_url, social_json
     FROM authors WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,[e]);return a?f(a):null}),e.s(["u",0,r,"i",0,i,"C",0,l])}];

//# sourceMappingURL=src_lib_1pc3ltd7cdwr3._.js.map