Metrics = new Meteor.Collection('metric');

Metrics.allow({
  insert: function (userId, doc) {
    return Meteor.settings.prod;
  },
  update: function (userId, doc, fields, modifier) {
    return Meteor.settings.prod;
  },
  remove: function (userId, doc) {
    return Meteor.settings.prod;
  }
});

var extract_options = function(mixpanel_url){
  exploded_url = Npm.require('url').parse(mixpanel_url, true);
  if (exploded_url.pathname != '/api/2.0/segmentation' || exploded_url.hostname != "mixpanel.com") {
    return false;
  } else {
    return _.omit(exploded_url.query, ["to_date", "from_date", "unit", "api_key", "expire", "sig"]);
  }
};

var fetch_metrics =  function(){
  var metrics = Metrics.find();
  metrics.forEach(function(metric){
    if("undefined" != typeof metric.mixpanel_url && "undefined" != typeof metric.options) {
      fetch_metric(metric);
    }
  });
};

var fetch_metric = function(metric){
  var Mixpanel_Exporter = Meteor.require('node-mixpanel-data-exporter');
  var mixpanel_exporter = new Mixpanel_Exporter({
    api_key: Meteor.settings.mixpanel_settings.key,
    api_secret: Meteor.settings.mixpanel_settings.secret
  });
  var result, basics, now, compare;
  var data = [], data2 = [];

  basics = {
    "unit": "hour"
  };

  now = {
    to_date: moment().format("YYYY-MM-DD"),
    from_date: moment().subtract("days",2).format("YYYY-MM-DD")
  };

  compare = {
    to_date: moment().subtract("days",7).format("YYYY-MM-DD"),
    from_date: moment().subtract("days",9).format("YYYY-MM-DD")
  };

  mixpanel_exporter.segmentationSync = Meteor._wrapAsync(mixpanel_exporter.segmentation.bind(mixpanel_exporter));
  result = mixpanel_exporter.segmentationSync(_.extend(metric.options, basics, now));

  res = JSON.parse(result.body);
  _.each(res.data.values, function(value, key){
    _.each(value, function(val, k){
      data.push({date:k,now:val});
    });
  });

  data = _(data).sortBy(function(datum) {
      return datum.date;
  });

  result = mixpanel_exporter.segmentationSync(_.extend(metric.options, basics, compare));

  res = JSON.parse(result.body);
  _.each(res.data.values, function(value, key){
    _.each(value, function(val, k){
      data2.push({date:k,compare:val});
    });
  });

  data2 = _(data2).sortBy(function(datum2) {
      return datum2.date;
  });

  _.each(data, function(val, i) {
    val.compare = data2[i].compare;
  });

  Metrics.update({_id:metric._id}, {$set: {data: data}});
};

Meteor.methods({
  parseOptions: function(id){
    if(!!Meteor.settings.prod){
      var metric  = Metrics.findOne({_id:id});
      if(metric.mixpanel_url) {
        var options = extract_options(metric.mixpanel_url);
        if(!_.isEqual(options, metric.options)){
          metric.options = options;
          Metrics.update({_id: metric._id}, {$set: {options: options}}, function(err, res){
            fetch_metric(metric);
          });
        }
      }
    }
  }
});

Meteor.startup(function () {
  Meteor.setInterval(fetch_metrics, 2 * 60 * 1000);
});
