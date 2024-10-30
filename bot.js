const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const merger = require('./merger');
const sharp = require('sharp');
const { createCanvas, loadImage, registerFont } = require('canvas');
const { performance } = require('perf_hooks');
const pLimit = require('p-limit');

// =========== //
const itemShopFont = 'assets/BurbankBigRegular-BlackItalic.ttf'; // The font you wish to use
const overlayPath = 'assets/overlay.png';

const checkForOgItems = true; // If false, it will not generate the OG items image.
const ogThreshold = 200; // Threshold to consider an item 'OG'
const pLimitValue = 30; // How many cache files can be downloaded at once
// =========== //

registerFont(itemShopFont, {
  family: 'Burbank Big Condensed',
  weight: 'Black',
  style: 'Italic',
});

const limit = pLimit(pLimitValue);

async function downloadImage(url, filename, folder = 'cache', retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fs.ensureDir(folder);
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
      });
      const contentType = response.headers['content-type'];
      let extension = 'png';

      if (contentType === 'image/webp') {
        extension = 'webp';
      } else if (contentType === 'image/jpeg') {
        extension = 'jpg';
      } else if (contentType === 'image/png') {
        extension = 'png';
      } else {
        console.error(`Unsupported content type: ${contentType}`);
        return null;
      }

      const fpath = path.join(folder, `${filename}.${extension}`);
      await fs.writeFile(fpath, response.data);
      return fpath;
    } catch (error) {
      console.error(`Attempt ${attempt} - Failed to download ${url}: ${error.message}`);
      if (attempt === retries) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function processItem(itemData, overlayBuffer) {
  const { filename, diff, price, name, filePath } = itemData;
  const imagePath = filePath;

  if (!imagePath || !(await fs.pathExists(imagePath))) {
    console.error(`Image file ${imagePath} does not exist. Skipping processing.`);
    return;
  }

  try {
    const backgroundBuffer = await sharp(imagePath).resize(512, 512).png().toBuffer();
    const overlayImage = await sharp(overlayBuffer).resize(512, 512).png().toBuffer();

    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');

    const bgImage = await loadImage(backgroundBuffer);
    ctx.drawImage(bgImage, 0, 0, 512, 512);

    const ovImage = await loadImage(overlayImage);
    ctx.drawImage(ovImage, 0, 0, 512, 512);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';

    ctx.font = '35px Italic Black "Burbank Big Condensed"';
    ctx.fillText(name, 256, 420);

    const diffText = diff === 'NEW!' ? 'NEW!' : `LAST SEEN: ${diff} day${diff !== '1' ? 's' : ''} ago`;
    ctx.font = '15px Italic Black "Burbank Big Condensed"';
    ctx.fillText(diffText, 256, 450);

    ctx.font = '40px Italic Black "Burbank Big Condensed"';
    ctx.fillText(`${price}`, 256, 505);

    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(path.join('cache', `${filename}.png`), buffer);
  } catch (error) {
    console.error(`Error processing item ${filename}: ${error.message}`);
  }
}

async function processOgItem(item, overlayBuffer) {
  const filename = `OG${item.id}`;
  const imagePath = item.filePath;

  if (!imagePath || !(await fs.pathExists(imagePath))) {
    console.error(`Image file ${imagePath} does not exist. Skipping processing.`);
    return;
  }

  try {
    const backgroundBuffer = await sharp(imagePath).resize(512, 512).png().toBuffer();
    const overlayImage = await sharp(overlayBuffer).resize(512, 512).png().toBuffer();

    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');

    const bgImage = await loadImage(backgroundBuffer);
    ctx.drawImage(bgImage, 0, 0, 512, 512);

    const ovImage = await loadImage(overlayImage);
    ctx.drawImage(ovImage, 0, 0, 512, 512);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';

    ctx.font = '35px Italic Black "Burbank Big Condensed"';
    ctx.fillText(item.name, 256, 420);

    const lastSeenDays = item.lastseen_days;
    const diffText = `LAST SEEN: ${lastSeenDays} day${lastSeenDays !== '1' ? 's' : ''} ago`;
    ctx.font = '15px Italic Black "Burbank Big Condensed"';
    ctx.fillText(diffText, 256, 450);

    ctx.font = '40px Italic Black "Burbank Big Condensed"';
    ctx.fillText(`${item.price}`, 256, 505);

    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(path.join('ogcache', `${filename}.png`), buffer);
  } catch (error) {
    console.error(`Error processing OG item ${filename}: ${error.message}`);
  }
}

async function genShop() {
  console.log('Generating the Fortnite Item Shop.');

  await fs.remove('cache');
  await fs.ensureDir('cache');

  const start = performance.now();

  const response = await axios.get('https://fortnite-api.com/v2/shop/br/combined');
  if (response.status !== 200) {
    console.error('Failed to fetch shop data.');
    return;
  }
  const data = response.data.data;
  const currentdate = data.date.slice(0, 10);

  console.log('\nFetching shop data...');
  const featured = data.featured;
  const itemDataList = [];

  if (featured) {
    for (const entry of featured.entries) {
      const i = entry;

      let url = null;

      const newDisplayAsset = i.newDisplayAsset || {};
      const materialInstances = newDisplayAsset.materialInstances || [];
      if (materialInstances.length > 0) {
        const images = materialInstances[0].images || {};
        url = images.Background || images.OfferImage;
      } else {
        const renderImages = newDisplayAsset.renderImages || [];
        if (renderImages.length > 0) {
          url = renderImages[0].image;
        }
      }

      if (!url) {
        url = i.items[0].images.icon;
      }

      const lastSeen = i.items[0].shopHistory || [];
      const lastSeenDate = lastSeen.length >= 2 ? lastSeen[lastSeen.length - 2].slice(0, 10) : 'NEW!';
      const price = i.finalPrice;

      let filename, name;

      if (i.bundle) {
        url = i.bundle.image;
        filename = `zzz${i.bundle.name}`;
        name = i.bundle.name;
      } else {
        filename = i.items[0].id;
        name = i.items[0].name;
      }

      let diff;

      if (lastSeenDate !== 'NEW!') {
        const diffDays = Math.max(
          1,
          Math.round((new Date(currentdate) - new Date(lastSeenDate)) / (1000 * 60 * 60 * 24))
        );
        diff = String(diffDays);
      } else {
        diff = 'NEW!';
      }

      const itemData = {
        filename,
        url,
        diff,
        price,
        name,
        currentdate,
      };

      itemDataList.push(itemData);
    }

    const downloadTasks = itemDataList.map((item) =>
      limit(async () => {
        const filePath = await downloadImage(item.url, item.filename);
        if (filePath) {
          item.filePath = filePath;
        }
      })
    );
    await Promise.all(downloadTasks);

    const overlayBuffer = await fs.readFile(overlayPath);

    const processTasks = itemDataList.map((item) =>
      limit(() => processItem(item, overlayBuffer))
    );
    await Promise.all(processTasks);

    console.log(`Done generating "${itemDataList.length}" items in the Featured section.`);

    console.log(`\nGenerated ${itemDataList.length} items from the ${currentdate} Item Shop.`);

    console.log('\nMerging images...');
    await merger(false, null, '', currentdate);

    const end = performance.now();

    console.log(`IMAGE GENERATING COMPLETE - Generated image in ${((end - start) / 1000).toFixed(2)} seconds!`);
  }
}

async function ogItems() {
  await fs.remove('ogcache');
  await fs.ensureDir('ogcache');

  const start = performance.now();

  const response = await axios.get('https://fortnite-api.com/v2/shop/br/combined');
  if (response.status !== 200) {
    console.error('Failed to fetch shop data.');
    return;
  }
  const data = response.data.data;
  const featured = data.featured;
  const currentdate = data.date.slice(0, 10);

  const resultlist = [];
  for (const entry of featured.entries) {
    for (const i of entry.items) {
      const shopHistory = i.shopHistory || [];
      const lastSeenDate = shopHistory.length >= 2 ? shopHistory[shopHistory.length - 2].slice(0, 10) : currentdate;
      const daysSinceLastSeen = Math.round(
        (new Date(currentdate) - new Date(lastSeenDate)) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastSeen >= ogThreshold) {
        const price = entry.finalPrice;
        resultlist.push({
          name: i.name,
          id: i.id,
          lastseen_days: String(daysSinceLastSeen),
          lastseen_date: lastSeenDate,
          type: i.type.displayValue,
          price,
          item_data: i,
        });
      }
    }
  }

  if (resultlist.length === 0) {
    console.log('There are no rare items.');
    return;
  }

  console.log('Rare cosmetics have been found');
  const rarestItem = resultlist.reduce((prev, current) =>
    parseInt(prev.lastseen_days) > parseInt(current.lastseen_days) ? prev : current
  );
  console.log(
    `The rarest item is the ${rarestItem.name} ${rarestItem.type}, which hasn't been seen in ${rarestItem.lastseen_days} days!`
  );

  console.log('Rare items:');
  for (const item of resultlist) {
    console.log(`- ${item.name} (${item.lastseen_days} days)\n`);
  }

  const downloadTasks = resultlist.map((item) =>
    limit(async () => {
      const filename = `OG${item.id}`;
      let fileExists = false;
      const extensions = ['png', 'jpg', 'webp'];
      let filePath;

      for (const ext of extensions) {
        const fpath = path.join('ogcache', `${filename}.${ext}`);
        if (await fs.pathExists(fpath)) {
          fileExists = true;
          filePath = fpath;
          break;
        }
      }

      if (!fileExists) {
        let url = null;
        const itm = item.item_data;

        const newDisplayAsset = itm.newDisplayAsset || {};
        const materialInstances = newDisplayAsset.materialInstances || [];
        if (materialInstances.length > 0) {
          const images = materialInstances[0].images || {};
          url = images.Background || images.OfferImage;
        } else {
          const renderImages = itm.images || {};
          url = renderImages.icon || renderImages.featured || renderImages.background;
        }

        if (url) {
          filePath = await downloadImage(url, filename, 'ogcache');
        }
      }

      if (filePath) {
        item.filePath = filePath;
      }
    })
  );
  await Promise.all(downloadTasks);

  const overlayBuffer = await fs.readFile(overlayPath);

  const processTasks = resultlist.map((item) =>
    limit(() => processOgItem(item, overlayBuffer))
  );
  await Promise.all(processTasks);

  await merger(true, null, '', currentdate);
  console.log(`Saved in shops/og folder as 'OGItems ${currentdate}.jpg'.\n`);

  const end = performance.now();
  console.log(`OG ITEMS IMAGE GENERATING COMPLETE - Generated image in ${((end - start) / 1000).toFixed(2)} seconds!`);
}

async function main() {
  if (checkForOgItems) {
    await Promise.all([genShop(), ogItems()]);
  } else {
    console.log('OG items generation is disabled.');
    await genShop();
  }
}

main().catch((error) => console.error('Error in main function:', error));
