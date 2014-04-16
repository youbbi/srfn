

var extract_options = function(mixpanel_url){
  var exploded_url = Npm.require('url').parse(mixpanel_url, true);
  if (exploded_url.pathname !== '/api/2.0/segmentation' || exploded_url.hostname !== "mixpanel.com") {
    return false;
  } else {
    return _.omit(exploded_url.query, ["to_date", "from_date", "unit", "api_key", "expire", "sig"]);
  }
};

var clean_url = function(mixpanel_url){
  var o = Npm.require('url').parse(mixpanel_url, true);
  if (o.pathname !== '/api/2.0/segmentation' || o.hostname !== "mixpanel.com") {
    return false;
  } else {
    o.query = _.omit(o.query, ["to_date", "from_date", "unit", "api_key", "expire", "sig"]);
    delete o.search;
    delete o.path;
    delete o.href;
    var url =  Npm.require('url').format(o);

    return url;
  }
};


var fetch_metric = function(metric){
  var Mixpanel_Exporter = Meteor.require('node-mixpanel-data-exporter');
  var mixpanel_exporter = new Mixpanel_Exporter({
    api_key: Meteor.settings.mixpanel_settings.key,
    api_secret: Meteor.settings.mixpanel_settings.secret
  });
  var result, res, basics, now, compare;
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

  // console.log('#fetch_metric: metric.options[mixpanel_url]=', metric.options['mixpanel_url']);

  mixpanel_exporter.segmentationSync = Meteor._wrapAsync(mixpanel_exporter.segmentation.bind(mixpanel_exporter));
  result = mixpanel_exporter.segmentationSync(_.extend(metric.options['mixpanel_url'], basics, now));

  res = JSON.parse(result.body);
  console.log('#fetch_metric: res=', res);
  _.each(res.data.values, function(value, key){
    _.each(value, function(val, k){
      data.push({date:k,now:val});
    });
  });

  data = _(data).sortBy(function(datum) {
      return datum.date;
  });

  var compareUrl = metric.options['mixpanel_url_compare'] || metric.options['mixpanel_url'];
  result = mixpanel_exporter.segmentationSync(_.extend(compareUrl, basics, compare));

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
    val.compare = _.isObject(data2[i]) ? data2[i].compare : 0;
  });

  Metrics.update({_id:metric._id}, {$set: {data: data}});
};

var fetch_metrics =  function(){
  var metrics = Metrics.find();
  metrics.forEach(function(metric){
    if("undefined" !== typeof metric.mixpanel_url && "undefined" !== typeof metric.options) {
      fetch_metric(metric);
    }
  });
};

var parseMixPanelUrl = function(metric) {

  var newData = {options: {}};
  var attributes = ['mixpanel_url']
  if (metric['mixpanel_url_compare'] && metric['mixpanel_url_compare'].length) attributes.push('mixpanel_url_compare');

  attributes.forEach(function(attribute){

    var options = extract_options(metric[attribute]);
    // console.log('options extracted for ' + attribute + ': ' + JSON.stringify(options));
    if(!_.isEqual(options, metric[attribute].options)){
      var clean = clean_url(metric[attribute]);
      newData.options[attribute] = options;
      newData[attribute] = clean;
    }
  })

  Metrics.update({_id: metric._id}, {$set: newData}, function(err, res){
      if (err) console.err('unable to update parseOptions, reason:', err);
      fetch_metric(metric);
  });
}

Meteor.methods({
  parseOptions: function(id){
    if(!Meteor.settings.demo){
      var metric  = Metrics.findOne({_id:id});
      console.log('#parseOptions: parsing for id=' + id + ' with metric.mixpanel_url=' + metric.mixpanel_url);
      parseMixPanelUrl(metric);
    }
  }
});

Meteor.startup(function () {
  Meteor.setInterval(fetch_metrics, 2 * 60 * 1000);
});
