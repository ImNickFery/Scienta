module.exports=[500874,(a,b,c)=>{b.exports=a.x("buffer",()=>require("buffer"))},254799,(a,b,c)=>{b.exports=a.x("crypto",()=>require("crypto"))},427699,(a,b,c)=>{b.exports=a.x("events",()=>require("events"))},504446,(a,b,c)=>{b.exports=a.x("net",()=>require("net"))},120635,(a,b,c)=>{b.exports=a.x("next/dist/server/app-render/action-async-storage.external.js",()=>require("next/dist/server/app-render/action-async-storage.external.js"))},324725,(a,b,c)=>{b.exports=a.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},556704,(a,b,c)=>{b.exports=a.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},832319,(a,b,c)=>{b.exports=a.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},559043,(a,b,c)=>{b.exports=a.x("next/dist/server/runtime-reacts.external.js",()=>require("next/dist/server/runtime-reacts.external.js"))},677652,(a,b,c)=>{b.exports=a.x("node:diagnostics_channel",()=>require("node:diagnostics_channel"))},902157,(a,b,c)=>{b.exports=a.x("node:fs",()=>require("node:fs"))},750227,(a,b,c)=>{b.exports=a.x("node:path",()=>require("node:path"))},605365,(a,b,c)=>{b.exports=a.x("process",()=>require("process"))},688947,(a,b,c)=>{b.exports=a.x("stream",()=>require("stream"))},99348,(a,b,c)=>{b.exports=a.x("string_decoder",()=>require("string_decoder"))},137464,(a,b,c)=>{b.exports=a.x("timers",()=>require("timers"))},755004,(a,b,c)=>{b.exports=a.x("tls",()=>require("tls"))},792509,(a,b,c)=>{b.exports=a.x("url",()=>require("url"))},224361,(a,b,c)=>{b.exports=a.x("util",()=>require("util"))},406461,(a,b,c)=>{b.exports=a.x("zlib",()=>require("zlib"))},800717,(a,b,c)=>{"use strict";b.exports=a.r(924951).vendored["react-rsc"].React},877283,a=>{"use strict";let b=["fa","en"],c={fa:"rtl",en:"ltr"};function d(a){return b.includes(a)}a.s(["i",0,function(a){return d(a)?c[a]:"ltr"},"b",0,d,"V",0,b])},701777,a=>{"use strict";let b={fa:()=>a.A(206762).then(a=>a.default),en:()=>a.A(584949).then(a=>a.default)};async function c(a){return(b[a]??b.fa)()}a.s(["f",0,c])},353214,a=>{"use strict";var b=a.i(800717),c=a.i(761469);let d="(a.status = 'published' OR (a.status = 'scheduled' AND a.scheduled_at IS NOT NULL AND a.scheduled_at <= NOW()))",e=(0,b.cache)(async()=>(await (0,c.z)(`SELECT f.slug, f.name_fa, f.name_en, f.color, f.icon,
            COUNT(a.id) AS article_count
     FROM fields f
     LEFT JOIN articles a
       ON a.field_id = f.id
      AND ${d}
      AND a.deleted_at IS NULL
     WHERE f.deleted_at IS NULL
     GROUP BY f.id, f.slug, f.name_fa, f.name_en, f.color, f.icon, f.sort_order
     ORDER BY f.sort_order ASC`)).map(a=>({slug:a.slug,name:{fa:a.name_fa,en:a.name_en},color:a.color,icon:a.icon,articleCount:Number(a.article_count??0)}))),f=(0,b.cache)(async a=>{let b=await (0,c.p)(`SELECT f.slug, f.name_fa, f.name_en, f.color, f.icon,
            COUNT(a.id) AS article_count
     FROM fields f
     LEFT JOIN articles a
       ON a.field_id = f.id
      AND ${d}
      AND a.deleted_at IS NULL
     WHERE f.slug = ? AND f.deleted_at IS NULL
     GROUP BY f.id, f.slug, f.name_fa, f.name_en, f.color, f.icon
     LIMIT 1`,[a]);return b?{slug:b.slug,name:{fa:b.name_fa,en:b.name_en},color:b.color,icon:b.icon,articleCount:Number(b.article_count??0)}:null});function g(a){return{slug:a.slug,name:{fa:a.name_fa,en:a.name_en},title:{fa:a.title_fa??"",en:a.title_en??""},bio:{fa:a.bio_fa??"",en:a.bio_en??""},avatar:a.avatar_url??"",social:function(a){if(a)try{let b=JSON.parse(a);if(!b||"object"!=typeof b||Array.isArray(b))return;return b}catch{return}}(a.social_json)}}let h=(0,b.cache)(async()=>(await (0,c.z)(`SELECT slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en, avatar_url, social_json
     FROM authors WHERE deleted_at IS NULL ORDER BY name_en ASC`)).map(g)),i=(0,b.cache)(async a=>{let b=await (0,c.p)(`SELECT slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en, avatar_url, social_json
     FROM authors WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,[a]);return b?g(b):null});a.s(["K",0,i,"u",0,h,"i",0,f,"C",0,e])}];

//# sourceMappingURL=%5Broot-of-the-server%5D__1-qgq9-n4lg_4._.js.map