# Use the Dashboard feature 

This feature uses the Sharp library to generate a png image from a dynamic SVG.
The image is updated whenever new data is fetched from TeslaFi, and streamed live.

## Version 1.2.0 and earlier
This feature is using chromium to generate the image displayed. If your install have issues with generating the image, se below.


## Configuring Homebridge TeslaFi plugin  

Add configuration option `dashboardImageFilePath` for the folder where you want the dashboard file to be created. If blank, no dashboard file is generated.

Example:  
`"dashboardImageFilePath": "/homebridge/"`

The path must be writable by the Homebridge process.

The file will be created as [name]_dashboard.png, where "name" is the configured name. If you have set it to `"name": "Elektra"`the full path will be (with config above):  
`/homebridge/Elektra_dashboard.png`

Full path is later used to configure homebridge-camera-ffmpeg.
The file created is in the size 720x480 px.  

The font used in the image depends on the configuration option `dashboardFontFamily`, you can specify multiple font familys. Quote the font name with single quotes. Make sure the font you want to use is installed on the server, fontconfig must be installed, use fc-list to get a list of available fonts. See more at https://github.com/lovell/sharp.
## Installing and configuring Homebridge Camera 

Follow the installation guide at [Homebridge Camera FFmpeg](https://github.com/Sunoo/homebridge-camera-ffmpeg). Easiest is just to search and install using Homebridge UI X.

Configure the homebridge-camera-ffmpeg with:  
`"source": "-f image2 -loop 1 -s 720x480 -pix_fmt yuvj422p -i /homebridge/Elektra_dashboard.png"`  

The above is what's been tested and works, but you can experiment with different settings.
Fore more details, check [Homebridge Camera FFmpeg](https://github.com/Sunoo/homebridge-camera-ffmpeg).

## Issues with generating the image  - Version 1.2.0 and earlier

Normally chromium headless is installed using puppeteer (as part of dependency in node-html-to-image) in node_modules. If the image is created once you have configured the path, all is fine.

If you run Homebridge using docker, and you see errors in the log, you can try creating a custom Docker image based on oznu/homebridge:ubuntu.

```
FROM oznu/homebridge:ubuntu

RUN apt update && apt-get install -y software-properties-common \
    && add-apt-repository ppa:canonical-chromium-builds/stage \
    && apt-get update && apt-get install -y chromium-browser libappindicator1 fonts-liberation fonts-noto-color-emoji

ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

```
This will generate a Docker image with Chromium pre-installed, and as seen by ENV variables, it tells puppeteer to use that instead of the version packaged in node_modules.

If you are not using Docker, you can probably use the same approach in the OS where you are running Homebridge. Also check [Puppeteer Troubleshooting](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md).

If you are you get "squares" for uknown charactes, you must add emoji support to your os installation. In Ubuntu this can be done with `sudo apt-get install fonts-noto-color-emoji`.