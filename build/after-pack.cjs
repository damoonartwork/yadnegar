// تنظیم آیکن و مشخصات فایل exe بدون نیاز به Wine (برای ساخت روی لینوکس هم کار می‌کند)
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const ResEdit = await import("resedit");
  const PE = await import("pe-library");
  const R = ResEdit.default ?? ResEdit;
  const P = PE.default ?? PE;

  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const ico = path.join(context.packager.projectDir, "build", "icon.ico");
  const version = context.packager.appInfo.version;

  const exeFile = P.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = P.NtExecutableResource.from(exeFile);

  const iconFile = R.Data.IconFile.from(fs.readFileSync(ico));
  const groups = R.Resource.IconGroupEntry.fromEntries(res.entries);
  const target = groups[0] ?? { id: 1, lang: 1033 };
  R.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    target.id,
    target.lang,
    iconFile.icons.map((i) => i.data)
  );

  const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0];
  if (vi) {
    const lang = vi.getAllLanguagesForStringValues()[0] ?? { lang: 1033, codepage: 1200 };
    vi.setStringValues(lang, {
      ProductName: "Yadnegar",
      FileDescription: "Yadnegar",
      CompanyName: "Damoon",
      OriginalFilename: "Yadnegar.exe",
      InternalName: "Yadnegar",
      LegalCopyright: "",
    });
    const [a, b, c] = version.split(".").map(Number);
    vi.setFileVersion(a, b, c, 0, lang.lang);
    vi.setProductVersion(a, b, c, 0, lang.lang);
    vi.outputToResourceEntries(res.entries);
  }

  res.outputResource(exeFile);
  fs.writeFileSync(exe, Buffer.from(exeFile.generate()));
  console.log("  • icon & version info set on", path.basename(exe));
};
