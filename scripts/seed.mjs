// Seeds the Scienta database: RBAC, a super admin user, taxonomy,
// default settings/menus, and the sample articles defined in
// sample-articles.mjs.
//
// Usage:
//   node --env-file=.env scripts/seed.mjs

import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { sampleArticles } from "./sample-articles.mjs";

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "aurora_science",
  dateStrings: true,
});

async function upsertRole(id, name, label, description) {
  await pool.execute(
    `INSERT INTO roles (id, name, label, description) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description)`,
    [id, name, label, description]
  );
}

async function main() {
  console.log("Seeding Scienta database…");

  // ---- Roles ----
  const roleIds = { super_admin: uuid(), admin: uuid(), editor: uuid() };
  await upsertRole(roleIds.super_admin, "super_admin", "Super Admin", "Full unrestricted access");
  await upsertRole(roleIds.admin, "admin", "Admin", "Manages content, settings, and users (view only)");
  await upsertRole(roleIds.editor, "editor", "Editor", "Manages articles and media");

  // ---- Permissions ----
  const permissionKeys = [
    "articles.manage", "categories.manage", "categories.view", "fields.manage", "fields.view",
    "tags.manage", "authors.manage", "authors.view", "media.manage", "settings.manage",
    "menus.manage", "pages.manage", "subscribers.manage", "messages.manage", "comments.manage", "logs.view",
    "users.view", "users.manage", "dashboard.view", "search.use", "backup.manage", "cache.manage",
  ];
  const permissionIds = {};
  for (const key of permissionKeys) {
    const id = uuid();
    permissionIds[key] = id;
    await pool.execute(
      `INSERT INTO permissions (id, \`key\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`key\` = VALUES(\`key\`)`,
      [id, key]
    );
  }

  // fetch actual ids (in case some already existed with different generated uuids)
  const [permRows] = await pool.query(`SELECT id, \`key\` FROM permissions`);
  const permByKey = Object.fromEntries(permRows.map((r) => [r.key, r.id]));
  const [roleRows] = await pool.query(`SELECT id, name FROM roles`);
  const roleByName = Object.fromEntries(roleRows.map((r) => [r.name, r.id]));

  const rolePermissionMap = {
    super_admin: permissionKeys, // gets everything explicitly too, for admin-UI display purposes
    admin: permissionKeys.filter((k) => k !== "users.manage"),
    editor: ["articles.manage", "categories.view", "fields.view", "tags.manage", "authors.view", "media.manage", "dashboard.view", "search.use"],
  };

  for (const [roleName, perms] of Object.entries(rolePermissionMap)) {
    for (const permKey of perms) {
      await pool.execute(
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [roleByName[roleName], permByKey[permKey]]
      );
    }
  }

  // ---- Super admin user ----
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@scienta.ir";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe_2026!";
  const [existingAdmin] = await pool.query(`SELECT id FROM users WHERE email = ?`, [adminEmail]);
  let adminId = existingAdmin[0]?.id;
  if (!adminId) {
    adminId = uuid();
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await pool.execute(
      `INSERT INTO users (id, name, email, password_hash, role_id, status) VALUES (?, ?, ?, ?, ?, 'active')`,
      [adminId, "Super Admin", adminEmail, passwordHash, roleByName.super_admin]
    );
    console.log(`  Created super admin: ${adminEmail} / ${adminPassword} (CHANGE THIS PASSWORD)`);
  } else {
    console.log(`  Super admin already exists: ${adminEmail}`);
  }

  // ---- Fields (scientific taxonomy) ----
  const fieldDefs = [
    { slug: "physics", name_fa: "فیزیک", name_en: "Physics", color: "#7B3FFB", icon: "atom" },
    { slug: "astronomy", name_fa: "نجوم و فضا", name_en: "Astronomy & Space", color: "#FF7A00", icon: "orbit" },
    { slug: "ai", name_fa: "هوش مصنوعی", name_en: "Artificial Intelligence", color: "#FF3C5A", icon: "cpu" },
    { slug: "space", name_fa: "کاوش فضایی", name_en: "Space Exploration", color: "#7B3FFB", icon: "rocket" },
    { slug: "quantum", name_fa: "محاسبات کوانتومی", name_en: "Quantum Computing", color: "#FF7A00", icon: "waves" },
    { slug: "math", name_fa: "ریاضیات", name_en: "Mathematics", color: "#FF3C5A", icon: "sigma" },
    { slug: "biology", name_fa: "زیست‌شناسی", name_en: "Biology", color: "#7B3FFB", icon: "dna" },
    { slug: "medicine", name_fa: "پزشکی", name_en: "Medicine", color: "#FF7A00", icon: "heart-pulse" },
    { slug: "engineering", name_fa: "مهندسی", name_en: "Engineering", color: "#FF3C5A", icon: "cog" },
    { slug: "technology", name_fa: "فناوری", name_en: "Technology", color: "#7B3FFB", icon: "microchip" },
  ];
  const fieldIds = {};
  for (const [i, f] of fieldDefs.entries()) {
    const [existing] = await pool.query(`SELECT id FROM fields WHERE slug = ?`, [f.slug]);
    const id = existing[0]?.id ?? uuid();
    fieldIds[f.slug] = id;
    await pool.execute(
      `INSERT INTO fields (id, slug, name_fa, name_en, color, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name_fa=VALUES(name_fa), name_en=VALUES(name_en), color=VALUES(color), icon=VALUES(icon)`,
      [id, f.slug, f.name_fa, f.name_en, f.color, f.icon, i]
    );
  }

  // ---- Default category ----
  const [existingCat] = await pool.query(`SELECT id FROM categories WHERE slug = ?`, ["deep-dive"]);
  const categoryId = existingCat[0]?.id ?? uuid();
  await pool.execute(
    `INSERT INTO categories (id, slug, name_fa, name_en) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name_fa = VALUES(name_fa), name_en = VALUES(name_en)`,
    [categoryId, "deep-dive", "بررسی عمیق", "Deep Dive"]
  );

  // ---- Authors ----
  const authorDefs = [
    { slug: "sara-ahmadi", name_fa: "سارا احمدی", name_en: "Sara Ahmadi", title_fa: "پژوهشگر فیزیک نظری", title_en: "Theoretical Physics Researcher", bio_fa: "سارا احمدی پژوهشگر فیزیک نظری با تمرکز بر گرانش کوانتومی و کیهان‌شناسی است.", bio_en: "Sara Ahmadi is a theoretical physics researcher focused on quantum gravity and cosmology." },
    { slug: "kian-moradi", name_fa: "کیان مرادی", name_en: "Kian Moradi", title_fa: "نویسنده علمی حوزه هوش مصنوعی", title_en: "AI Science Writer", bio_fa: "کیان مرادی درباره یادگیری ماشین، شبکه‌های عصبی و آینده هوش مصنوعی می‌نویسد.", bio_en: "Kian Moradi writes about machine learning, neural networks, and the future of AI." },
    { slug: "elham-rostami", name_fa: "الهام رستمی", name_en: "Elham Rostami", title_fa: "اخترفیزیک‌دان", title_en: "Astrophysicist", bio_fa: "الهام رستمی اخترفیزیک‌دانی است که روی سیاه‌چاله‌ها و امواج گرانشی کار می‌کند.", bio_en: "Elham Rostami is an astrophysicist working on black holes and gravitational waves." },
  ];
  const authorIds = {};
  for (const a of authorDefs) {
    const [existing] = await pool.query(`SELECT id FROM authors WHERE slug = ?`, [a.slug]);
    const id = existing[0]?.id ?? uuid();
    authorIds[a.slug] = id;
    await pool.execute(
      `INSERT INTO authors (id, slug, name_fa, name_en, title_fa, title_en, bio_fa, bio_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name_fa=VALUES(name_fa), name_en=VALUES(name_en), title_fa=VALUES(title_fa), title_en=VALUES(title_en), bio_fa=VALUES(bio_fa), bio_en=VALUES(bio_en)`,
      [id, a.slug, a.name_fa, a.name_en, a.title_fa, a.title_en, a.bio_fa, a.bio_en]
    );
  }

  // ---- Seed sample articles ----
  for (const article of sampleArticles) {
    const [existingArticle] = await pool.query(
      `SELECT a.id FROM articles a JOIN article_translations t ON t.article_id = a.id WHERE t.locale='fa' AND t.slug = ?`,
      [article.slug]
    );
    const articleId = existingArticle[0]?.id ?? uuid();

    if (!existingArticle[0]) {
      await pool.execute(
        `INSERT INTO articles (id, field_id, category_id, author_id, status, featured, trending, views, published_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?)`,
        [
          articleId,
          fieldIds[article.field] ?? null,
          categoryId,
          authorIds[article.authorSlug] ?? null,
          article.featured ? 1 : 0,
          article.trending ? 1 : 0,
          article.views ?? 0,
          article.publishedAt,
          adminId,
          adminId,
        ]
      );
    }

    for (const locale of ["fa", "en"]) {
      const t = article[locale];
      await pool.execute(
        `INSERT INTO article_translations (id, article_id, locale, title, slug, excerpt, content, seo_title, seo_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), excerpt=VALUES(excerpt), content=VALUES(content)`,
        [uuid(), articleId, locale, t.title, article.slug, t.excerpt, t.content, t.title, t.excerpt]
      );
    }

    for (const tagName of article.tags ?? []) {
      const tagSlug = tagName.toLowerCase().replace(/\s+/g, "-");
      const [existingTag] = await pool.query(`SELECT id FROM tags WHERE slug = ?`, [tagSlug]);
      const tagId = existingTag[0]?.id ?? uuid();
      if (!existingTag[0]) {
        await pool.execute(`INSERT INTO tags (id, slug, name_fa, name_en) VALUES (?, ?, ?, ?)`, [tagId, tagSlug, tagName, tagName]);
      }
      await pool.execute(`INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)`, [articleId, tagId]);
    }

    console.log(`  Seeded article: ${article.slug}`);
  }

  // ---- Default settings ----
  const defaultSettings = {
    site_title: JSON.stringify({ fa: "Scienta", en: "Scienta" }),
    site_description: JSON.stringify({
      fa: "پلتفرم علمی غوطه‌ور برای روایت‌های عمیق در فیزیک، فضا، هوش مصنوعی و ریاضیات.",
      en: "An immersive scientific platform for deep narratives in physics, space, AI, and mathematics.",
    }),
    logo_url: JSON.stringify(null),
    favicon_url: JSON.stringify(null),
    social_links: JSON.stringify({ twitter: "", instagram: "", telegram: "", linkedin: "" }),
    footer_text: JSON.stringify({ fa: "پلتفرمی برای کنجکاوهای علمی.", en: "A platform for the scientifically curious." }),
    homepage_sections: JSON.stringify(["hero", "featured", "fields", "latest", "trending"]),
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await pool.execute(
      `INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`value\` = \`value\``,
      [key, value]
    );
  }

  // ---- Default menus ----
  for (const menu of [{ key: "primary", label: "Primary Navigation" }, { key: "footer", label: "Footer Links" }]) {
    const [existing] = await pool.query(`SELECT id FROM menus WHERE \`key\` = ?`, [menu.key]);
    if (!existing[0]) {
      await pool.execute(`INSERT INTO menus (id, \`key\`, label) VALUES (?, ?, ?)`, [uuid(), menu.key, menu.label]);
    }
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
