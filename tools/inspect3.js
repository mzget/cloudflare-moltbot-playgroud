const Jimp = require('jimp');
(async () => {
  const img = await Jimp.Jimp.read('screenshot.png');
  console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(img)).filter(k=>typeof img[k]==='function'));
})();
