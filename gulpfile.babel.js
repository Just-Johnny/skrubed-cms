import gulp from "gulp";
import cp from "child_process";
import gutil from "gulp-util";
import postcss from "gulp-postcss";
import cssImport from "postcss-import";
import cssnext from "postcss-cssnext";
import BrowserSync from "browser-sync";
import webpack from "webpack";
import webpackConfig from "./webpack.conf";
import svgstore from "gulp-svgstore";
import svgmin from "gulp-svgmin";
import inject from "gulp-inject";
import imagemin from "gulp-imagemin";
import changed from "gulp-changed";
import cssnano from "cssnano";

const browserSync = BrowserSync.create();
const defaultArgs = ["-d", "../dist", "-s", "site"];

var hugoBin = `./bin/hugo.${process.platform === "win32" ? "exe" : process.platform}`;

if (process.env.HUGO_VERSION) {
  hugoBin = 'hugo'
}

if (process.env.DEBUG) {
  defaultArgs.unshift("--debug")
}

gulp.task("hugo", (cb) => buildSite(cb));
gulp.task("hugo-preview", (cb) => buildSite(cb, ["--buildDrafts", "--buildFuture"]));
gulp.task("build", ["css", "imagemin", "js", "hugo"]);
gulp.task("build-preview", ["css", "imagemin", "js", "hugo-preview"]);

gulp.task("css", () => (
  gulp.src("./src/css/*.css")
  .pipe(postcss([
    cssImport({
      from: "./src/css/main.css"
    }),
    cssnext(),
    //cssnano(),
  ]))
  .pipe(gulp.dest("./dist/css"))
  .pipe(browserSync.stream())
));

gulp.task('imagemin', () => (
  gulp.src('./src/img/*')
  .pipe(changed("./dist/img"))
  .pipe(imagemin([
    imagemin.gifsicle({
      interlaced: true
    }),
    imagemin.jpegtran({
      progressive: true
    }),
    imagemin.optipng({
      optimizationLevel: 5
    }),
    imagemin.svgo({
      plugins: [{
          removeViewBox: true
        },
        {
          cleanupIDs: false
        }
      ]
    })
  ]))
  .pipe(gulp.dest('./dist/img'))
  .pipe(browserSync.stream())
));

gulp.task("js", (cb) => {
  const myConfig = Object.assign({}, webpackConfig);

  webpack(myConfig, (err, stats) => {
    if (err) throw new gutil.PluginError("webpack", err);
    gutil.log("[webpack]", stats.toString({
      colors: true,
      progress: true
    }));
    browserSync.reload();
    cb();
  });
});

gulp.task("svg", () => {
  const svgs = gulp
    .src("site/static/img/icons-*.svg")
    .pipe(svgmin())
    .pipe(svgstore({
      inlineSvg: true
    }));

  function fileContents(filePath, file) {
    return file.contents.toString();
  }

  return gulp
    .src("site/layouts/partials/svg.html")
    .pipe(inject(svgs, {
      transform: fileContents
    }))
    .pipe(gulp.dest("site/layouts/partials/"));
});

gulp.task("server", ["hugo", "css", "imagemin", "js", "svg"], () => {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });
  gulp.watch("./src/js/**/*.js", ["js"]);
  gulp.watch("./src/css/**/*.css", ["css"]);
  gulp.watch("./src/img/*.+(png|jpg|jpeg|gif)", ["imagemin"]);
  gulp.watch("./site/static/img/icons-*.svg", ["svg"]);
  gulp.watch("./site/**/*", ["hugo"]);
});

function buildSite(cb, options) {
  const args = options ? defaultArgs.concat(options) : defaultArgs;

  return cp.spawn(hugoBin, args, {
    stdio: "inherit"
  }).on("close", (code) => {
    if (code === 0) {
      browserSync.reload("notify:false");
      cb();
    } else {
      browserSync.notify("Hugo build failed :(");
      cb("Hugo build failed");
    }
  });
}