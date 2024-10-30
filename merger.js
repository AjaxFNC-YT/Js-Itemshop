const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { createCanvas, loadImage, registerFont } = require('canvas');

// =========== //
const fontPath = 'assets/BurbankBigRegular-BlackItalic.ttf'; // The path to the font you want to use

const shopbgPath = 'assets/shopbg.png'; // Path to shop background

const normalTitleText = 'Item Shop'; // Title for the main item shop image
const ogTitleText = 'OG Items'; // Title for the OG items image

const showDateNormal = true; // Should the date be shown in the normal image?
const showDateOg = true; // Should the date be shown in the OG items image?
// =========== //

registerFont(fontPath, {
  family: 'Burbank Big Regular Black Italic',
});

async function merger(ogitems, datas = null, saveAs = '', currentdate = null) {
  let datasList;

  if (!datas) {
    if (!ogitems) {
      console.log('[MERGER] OG Items is false, getting files from cache');
      const list = (await fs.readdir('cache'))
        .filter((file) => file.endsWith('.png') && !file.startsWith('temp'))
        .map((file) => path.join('cache', file));
      datasList = list;
    } else {
      console.log('[MERGER] OG Items is true, getting files from ogcache');
      const list = (await fs.readdir('ogcache'))
        .filter((file) => file.endsWith('.png'))
        .map((file) => path.join('ogcache', file));
      datasList = list;
    }
  }

  if (!datasList || datasList.length === 0) {
    console.log('[MERGER] No images to merge.');
    return;
  }

  const images = await Promise.all(
    datasList.map(async (filePath) => {
      try {
        const imageBuffer = await sharp(filePath).png().toBuffer();
        const img = await loadImage(imageBuffer);
        return img;
      } catch (error) {
        console.error(`Error loading image ${filePath}: ${error.message}`);
        return null;
      }
    })
  );

  const validImages = images.filter((img) => img !== null);

  if (validImages.length === 0) {
    console.log('[MERGER] No valid images to merge.');
    return;
  }

  let titleText, showDate;

  if (ogitems) {
    titleText = ogTitleText;
    showDate = showDateOg;
  } else {
    titleText = normalTitleText;
    showDate = showDateNormal;
  }

  const rowN = validImages.length;
  const rowsLen = Math.ceil(Math.sqrt(rowN));
  const columnsLen = Math.ceil(rowN / rowsLen);

  const px = 512;
  const titleAreaHeight = 322;
  const totalWidth = rowsLen * px;
  const totalHeight = columnsLen * px + titleAreaHeight;

  const bgTile = await loadImage(shopbgPath);

  const canvas = createCanvas(totalWidth, totalHeight);
  const ctx = canvas.getContext('2d');

  for (let x = 0; x < totalWidth; x += bgTile.width) {
    for (let y = 0; y < totalHeight; y += bgTile.height) {
      ctx.drawImage(bgTile, x, y, bgTile.width, bgTile.height);
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = 'white';

  let fontSize = 150;
  const maxFontSize = 200;
  const minTitleFontSize = 60;

  const maxWidth = totalWidth - 40;
  let displayTitleText = titleText;

  ctx.font = `Italic ${fontSize}px "Burbank Big Regular Black Italic"`;
  let textMetrics = ctx.measureText(displayTitleText);
  let textWidth = textMetrics.width;

  while (textWidth > maxWidth && fontSize >= minTitleFontSize) {
    fontSize -= 2;
    ctx.font = `Italic ${fontSize}px "Burbank Big Regular Black Italic"`;
    textMetrics = ctx.measureText(displayTitleText);
    textWidth = textMetrics.width;
  }

  if (textWidth > maxWidth) {
    const maxChars = Math.floor(displayTitleText.length * (maxWidth / textWidth));
    displayTitleText = displayTitleText.slice(0, maxChars) + '...';
    ctx.font = `Italic ${fontSize}px "Burbank Big Regular Black Italic"`;
    textMetrics = ctx.measureText(displayTitleText);
    textWidth = textMetrics.width;
  }

  let fontDateSize = showDate ? Math.max(Math.floor(fontSize * 0.5), 30) : 0;
  let totalTextHeight = fontSize + fontDateSize + 20;

  while (textWidth <= maxWidth && totalTextHeight <= titleAreaHeight && fontSize < maxFontSize) {
    fontSize += 2;
    ctx.font = `Italic ${fontSize}px "Burbank Big Regular Black Italic"`;
    textMetrics = ctx.measureText(displayTitleText);
    textWidth = textMetrics.width;
    fontDateSize = showDate ? Math.max(Math.floor(fontSize * 0.5), 30) : 0;
    totalTextHeight = fontSize + fontDateSize + 20;
  }

  fontSize -= 2;
  ctx.font = `Italic ${fontSize}px "Burbank Big Regular Black Italic"`;
  fontDateSize = showDate ? Math.max(Math.floor(fontSize * 0.5), 30) : 0;
  totalTextHeight = fontSize + fontDateSize + 20;

  const startY = (titleAreaHeight - totalTextHeight) / 2 + fontSize;

  ctx.fillText(displayTitleText, totalWidth / 2, startY);

  if (showDate) {
    const dateText = currentdate || new Date().toISOString().slice(0, 10);
    ctx.font = `Italic ${fontDateSize}px "Burbank Big Regular Black Italic"`;
    ctx.fillText(dateText, totalWidth / 2, startY + fontDateSize + 20);
  }

  let idx = 0;
  for (let y = 0; y < columnsLen; y++) {
    for (let x = 0; x < rowsLen; x++) {
      if (idx >= validImages.length) break;
      const img = validImages[idx];
      ctx.drawImage(img, x * px, y * px + titleAreaHeight, px, px);
      idx += 1;
    }
  }

  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.85 });

  const dateText = currentdate || new Date().toISOString().slice(0, 10);

  if (ogitems) {
    await fs.ensureDir('shops/og');
    saveAs = `shops/og/OGItems ${dateText}.jpg`;
  } else {
    await fs.ensureDir('shops');
    saveAs = `shops/shop ${dateText}.jpg`;
  }

  await fs.writeFile(saveAs, buffer);

  console.log(`[MERGER] Image saved as ${saveAs}`);
}

module.exports = merger;
