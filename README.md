[![Build Status](https://travis-ci.org/errows/srfn.png?branch=master)](https://travis-ci.org/errows/srfn)
[![Code Climate](https://codeclimate.com/github/errows/srfn.png)](https://codeclimate.com/github/errows/srfn)

#srfn - Data Monitoring Tool

srfn is a Mixpanel data monitoring tool. The need emerged when we wanted to precisely monitor tracking events with a particular set of properties. No online dashboards offered the ability to filter segmentation on multiple properties.

##Setup

Install [Meteor](http://meteor.com) and [Meteorite](https://github.com/oortcloud/meteorite)

##Running srfn

Clone this project, cd into it, modify ```settings.json``` with your Mixpanel API key and secret and then:

``` sh
$ meteor update
$ mrt run --settings settings.json
```

###Note
To enable demo mode, add a root ```"demo":true``` setting and writes will be denied.

##Using srfn

Log in to Mixpanel, go to the segmentation section and build a query you'd like to monitor. Open the developper tools and grab the URL being queried by Mixpanel. Paste this URL into a new field in the edit section of srfn. It will look like this:

```
https://mixpanel.com/api/2.0/segmentation?event=event_name&type=general&where=%22something%22+in+properties%5B%22somewhere%22%5D&to_date=2014-02-26&from_date=2014-01-28&unit=day&api_key=aaa&expire=1393480202&sig=bbb
```

##Deploying to Heroku

Mixpanel API key and secret need to be added as a ```METEOR_SETTINGS``` environment variable:

``` sh
$ heroku create --stack cedar --buildpack https://github.com/oortcloud/heroku-buildpack-meteorite.git
$ heroku config:add METEOR_SETTINGS="`cat settings.json`"
$ heroku config:add ROOT_URL=http://your.domain.com
$ heroku labs:enable websockets
$ git push heroku master
```

##Tests

Start by installing [Laika](http://arunoda.github.io/laika/) and then you can, as explained in the Laika doc, start a mongodb server for the tests and run the tests:

``` sh
$ mongod --smallfiles --noprealloc --nojournal
```

in another window:

``` sh
$ laika -s settings.json
```
