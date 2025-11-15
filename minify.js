const UglifyJS = require("uglify-js");
const CleanCSS = require("clean-css");
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");
const publicAssetsDir = path.join(publicDir, "assets");
const srcAdminDir = path.join(__dirname, "src", "admin");
const srcAssetsDir = path.join(__dirname, "src", "assets");

// Minifier CSS
function minifyCss(inputPath, outputPath) {
  const css = fs.readFileSync(inputPath, "utf8");
  const minifiedCss = new CleanCSS().minify(css).styles;
  fs.writeFileSync(outputPath, minifiedCss);
  console.log(`Minified CSS: ${inputPath} -> ${outputPath}`);
}

// Minifier JS
function minifyJs(inputPath, outputPath) {
  const js = fs.readFileSync(inputPath, "utf8");
  const minifiedJs = UglifyJS.minify(js).code;
  fs.writeFileSync(outputPath, minifiedJs);
  console.log(`Minified JS: ${inputPath} -> ${outputPath}`);
}

// Process public assets
function processPublicAssets() {
  // Minify CSS
  minifyCss(
    path.join(publicAssetsDir, "style.css"),
    path.join(publicAssetsDir, "style.min.css")
  );
  minifyCss(
    path.join(publicAssetsDir, "login.css"),
    path.join(publicAssetsDir, "login.min.css")
  );

  // Minify JS (assuming index.html has inline script, or external js files)
  // For now, let's assume there's a main.js in public/
  // If there are actual JS files, they should be listed here.
  // For this example, I'll assume a public/main.js and public/login.js if they exist.
  // If the scripts are inline, they need to be extracted first.
  // Based on previous read_file, scripts are inline in index.html and login.html.
  // This part needs to be handled carefully. For now, I'll skip inline script minification
  // and focus on external files if they were to exist.
}

// Process src/admin assets
function processAdminAssets() {
  // Minify CSS
  minifyCss(
    path.join(srcAssetsDir, "admin.css"),
    path.join(srcAssetsDir, "admin.min.css")
  );
  minifyCss(
    path.join(srcAssetsDir, "admin-login.css"),
    path.join(srcAssetsDir, "admin-login.min.css")
  );

  // Minify JS (similar to public, assuming external JS files)
}

function runMinification() {
  console.log("Starting minification...");
  processPublicAssets();
  processAdminAssets();
  console.log("Minification complete.");
}

runMinification();
