# Homebridge TeslaFi

This plugin for Homebridge lets you view status and control your Tesla usin Homekit via the TeslaFi API.  

---
**NOTE:**  
Before you go ahead and install this plugin, you must have an account at [TeslaFi](https://about.teslafi.com), that is a service you have to pay to use. This plugin is however free, but as a thank you you can use this referral link to [sign up for TeslaFi](https://www.teslafi.com/signup.php?referred=loftux).  
If you don't even own a Tesla yet, buy using this [referral link](https://ts.la/peter18116) to get free supercharger miles.

---

## Features

* **Online status:** Shows if your car is online or sleeping. Lets you wake your Tesla if it is sleeping.
* **Sentry Mode:** Turn Sentry mode On or Off.
* **Charger:** Start and Stop charging, track battery level. Configurable low battery warning level. Set charge level.
* **Charge Port:** Open and Close the charge port.
* **Climate Control:**  Start and Stop the Climate system. Set the temperature.
* **Door lock:** Unlock and lock doors.
* **New Software version:** Trigger Occupancy sensor when a new software version is available/installing.
* **Tagged Locations:** Trigger Occupancy sensor when car is at a TeslaFi tagged location. Match one or more locations that you have named in TeslaFi.
* **Tesla Status Dashboard:** Show data from the car using [Homebridge Camera FFmpeg](https://github.com/Sunoo/homebridge-camera-ffmpeg)

State of each accessory is updated if changed outside of Homekit. For example, when Sentry Mode is activated, it will give you a notification in Homekit. Each accessory can be disabled if you do not intend to use it. 

![Screenshot](https://raw.githubusercontent.com/loftux/homebridge-teslafi/master/images/screenshot.PNG)

### Why use this plugin?
Each application or plugin that you have that polls data from you Tesla makes it harder for your car to sleep, and thus drain battery. TeslaFi already manage this well, and by polling the TeslaFi API instead of Tesla API directly, we do not interfere with sleep attempts.

It is also fast, Homekit is very sensitive to slow responses. This plugin polls data from TeslaFi with a set intervall, and already has the data whe Homekit requests it. However, there will be a small delay to pick up external changes, for example when you start charging the car, it can take 1-2 minutes (depending on poll intervall) before your Homekit shows as Charging. Better than the dreadful 'No response'.

## Configuration
You must create and get your TeslaFi API token. Login to your TeslaFi account, select *Settings*, *Account* and *Advanced* at the bottom of the page. Then select *TeslaFi API Access* link and create your token.  
**NOTE:** TeslaFi API Token is NOT the same as a Tesla token and must be created separately.

On the TeslaFi API page, enable or disable the API functions you intend to use. For example, if you plan to use the Climate Control, enable *Start HVAC*, *Stop HVAC*, *Set HVAC Temperature*. If not enabled in TeslaFi, the changes sent via Homekit will be ignored.  

This plugin supports configuation using the [Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x).

### Tesla Dashboard using Camera
**BETA Feature**  

Creating the dashboard image is off by default. Follow this [guide to configure dashboard](https://github.com/loftux/homebridge-teslafi/blob/master/docs/dashboard.md).

### Configuration in your Home app
Since Apple Homekit do not have Accessories that maps 1 to 1 with managing a car, implementation has to choose existing Homekit accessories. Thus, the charging level is set using a Light Bulb (!), because that adds a slider to use for changing charge level. It will always stay on.
What you can do is to exclude it from showing in "status". Long press the accessory, scroll down to the settings icon, choose status. Un-tick include in home status. This way you get a cleaner interface.

The Battery Charger acessory also has two bundled items. One that turns charging on/off, and one that sets the charge level. In Apple Home app, you can optionally show them as separate accessories.

For a nicer look, change the icons from the default ones. Unfortunately Apple doesn't inlude that many, but there are some that you may feel are more fit for managing a car.

### Multiple Car support
If you are using Homebridge 1.3.0 or above, you can add multiple cars using the child-bridge feature available from [1.3.0 of Homebridge](https://github.com/homebridge/homebridge/releases/tag/v1.3.0). Please consult the Homebridge documentation. You will also need multiple TeslaFi accounts.

### Manual configuration

Setting | Explanation
------------ | -------------
"platform"| "TeslafiPlugin" -  Always this value
"name" | The name added to the Accessory and shows in HomeKit
"token" | TeslaFi token. Get this from your TeslaFi account
"useNamePrefix" | If the cars name should be prefix the Accessory name. Recommended if you will setup for multiple cars.  
"dashboardImageFilePath" | Path to where plugin should create dashboard image file. Leave as empty string if not using this feature.
"lowBatterylevel" | When the Low Battery warning should be triggered by HomeKit
"chargeLevelIncrement" | Value between 1-5, 1 lets you set any target charge level between 50-100%, 5 set in steps of 5 and is easier to pinpoint with the slider. If max charge level value is set with the Tesla app or in any other way that differs from set increment, the rounded value is shown and can differ from actual set exact value. If this matters, use 1 as increment.
"teslafiRefreshTimeout" | How often to poll TeslaFi for latest data. The default 60s is recommended, min value is 30s. Shorter is not always better, as TeslaFi only polls once per minute.
"wakeupTimeout" | A value of 0 will not try to wake the car if it is sleeping. Default is 15, so if the car is sleeping, wait 15s after waking the car until command is committed. If your car is slow to wake up, add some time. If to long, HomeKit can time out and think there is no response.
"tempUnit" | C or F, turns out HomeKit handles this, all is handled in C internally and your iOS settings will display matching your locale settings.
"rangeUnit" | "km" or "miles". To be used when range display is added.
"taggedLocations" | String array of named locations in TeslaFi. This will add an Occupancy sensor that trigggers whe TeslaFi has reported you ar at that location. You can add as many (reasonably) as you like. Must match the exakt name in TeslaFi. "No Tagged Location Found" is what TeslaFi use when there is no tagged location, this also works.
"disable\<AccessoryName\>" | If you don't want to use a particular Accessory, you can disable it. See available options below.




    "platforms": [
        {
            "platform": "TeslafiPlugin",
            "name": "MyTesla",
            "token": "<TeslaFi token>",
            "useNamePrefix": true,
            "dashboardImageFilePath": "/homebridge/"
            "lowBatterylevel": 20,
            "chargeLevelIncrement": 5
            "teslafiRefreshTimeout": 60,
            "wakeupTimeout": 15,
            "tempUnit": "C",
            "rangeUnit": "km",
            "taggedLocations": [
                "Fremont",
                "Grünheide",
                "No Tagged Location Found"
            ],
            "disableTeslaOnlineAccessory": false,
            "disableTeslaSentryAccessory": false,
            "disableTeslaBatteryAccessory": false,
            "disableTeslaThermostatAccessory": false,
            "disableTeslaChargePortAccessory": false,
            "disableTeslaDoorLockAccessory": false
        }
    ]
    

## Known issues and limitations
If you have your polling of TeslaFi set to low (min 30s), then when you turn on for example Climate or Sentry mode, the control can switch back to previous mode (on/off). This is because TeslaFi has not yet polled the car and has the updated data from the car. So after another minut or so, the Accessory will turn on/off again and show the setting you wanted. If this becomes a problem for you, increase the polling time, and TeslaFi will have picked up the change before the plugin polls for the data.

Trunk/Frunk. TeslaFi API does not allow for unlocking the trunk or frunk. So there will be no Accessory for that for now.

## Coming features and ideas
This are things that I'm looking into implementing, and that is supported by the TeslaFi API.

* Switch to Enable / Disable logging in TeslaFi. This will most likely turn off getting the data needed for this plugin, so not sure how useful this would be.
* Start Polling - A switch let calls the TeslaFi API to start polling. Can be used to let TeslaFi know that you now intend to use the car, and skip trying to sleep.
* Switch for max defrost.
* DONE: Be able to change charge level.
* DONE: Location Aware sensors - TeslaFi returns when your car is in one of your user defined locations. This can be used to trigger a Homekit sensor, and then used for automation.
* DONE: Sensor for new version available. Then use Automation to turn all you light bulbs on 100% so that you don't miss installing right away!
* Sensor for  "is_user_present": "1"
* Sensor for Driving.