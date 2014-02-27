[![Build Status](https://travis-ci.org/errows/srfn.png?branch=master)](https://travis-ci.org/errows/srfn)

#srfn - Data Monitoring Tool

srfn is a Mixpanel data monitoring tool. The need emerged when we wanted to precisely monitor tracking events with a particular set of properties. No online dashboards offered the ability to filter on multiple properties.

##Setup

Install [Meteor](http://meteor.com) and [Meteorite](https://github.com/oortcloud/meteorite)

##Running srfn

Clone this project, cd into it, modify ```settings.json``` with your Mixpanel API key and secret and then:

``` sh
$ mrt run --settings settings.json
```

###Tip

If you don't want to commit the changes to the settings.json file, tell GIT to ignore the changes:

``` sh
git update-index --assume-unchanged settings.json
```

##Deploying to Heroku

Mixpanel API key and secret need to be added as a ```METEOR_SETTINGS``` environment variable:

``` sh
heroku config:add METEOR_SETTINGS='{"mixpanel_settings" : {"key": "AAA","secret": "BBB"}}'
```

##Tests

Start by installing [Laika](http://arunoda.github.io/laika/) and then you can, as explained in the Laika doc, start a mongodb server for the tests and run the tests:

``` sh
$ mongod --smallfiles --noprealloc --nojournal
```

in another window:

``` sh
$ laika
```
