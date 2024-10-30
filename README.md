# Js-ItemShop
A chatgpt translation of my other repo: https://github.com/AjaxFNC-YT/Py-ItemShop


> [!WARNING]  
> This was created as a test, and will is NOT maintainted, at the moment it should work.
> The [python version](https://github.com/AjaxFNC-YT/Py-ItemShop) is maintainted, and will always work.


### Overview
This script generates an image of the current Fortnite item shop, saving it in a folder. This project was based on the [Fortnite-Shop-Bot](https://github.com/FortniteFevers/Fortnite-Shop-Bot) by FortniteFevers.


### Known Issues:
- Font not loading/working (is fixed/working on the [python version](https://github.com/AjaxFNC-YT/Py-ItemShop))

### Examples:
![Item Shop](https://cdn.ajaxfnc.com/uploads/shopballs/nodejs/shops.jpg)
![OG Items](https://cdn.ajaxfnc.com/uploads/shopballs/nodejs/ogitems.jpg)


### Installation Guide

#### Step 1: Install Nodejs
1. Download and install Python from the [official nodejs website](https://nodejs.org/en/download/prebuilt-installer).

To verify that Nodejs is correctly installed, open a terminal or command prompt and run:

```bash
node --version
```

This should display the installed Nodejs version.

#### Step 2: Download
- Download the code by going to **Code** then **Download ZIP** on the repository page.
- Extract the contents of the ZIP file to a directory of your choice.

#### Step 3: Install Dependencies
- Open a terminal in the directory where you extracted the files.
- Run the following command to install the required Nodejs modules:

  ```bash
  npm install axios fs-extra sharp canvas p-limit@3.6.0
  ```

#### Step 4: Configure Settings (Optional)
- The settings for the app is in the `bot.js` file and the `merger.js` files, the merger file is for the final image, bot is for creating all the smaller images

### Running the Script
Once everything is set up, you can generate the Fortnite item shop image by running:

```bash
node bot.js
```

This will save the generated images in the `shops` folder.
