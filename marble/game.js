/* 弹弹珠机 - 微信小游戏入口
 * 微信开发者工具直接导入本目录即可运行(本项目根目录就是小游戏项目根)。
 * 正式上传双平台请运行 `node tools/build-minigames.js`,产出 dist/wx 与 dist/douyin
 * (BGM 压缩进分包,主包 <4MB)。
 */
require('./src/core/util.js');
require('./src/platform/platform.js');
require('./src/core/audio.js');
require('./src/game/agebadge.js');
require('./src/game/music.js');
require('./src/core/physics.js');
require('./src/game/config.js');
require('./src/game/entities.js');
require('./src/game/board.js');
require('./src/game/fx.js');
require('./src/game/ui.js');
require('./src/game/marble-game.js');
require('./src/main.js');
