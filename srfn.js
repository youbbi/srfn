Metrics = new Meteor.Collection('metric');

Router.configure({
  layoutTemplate: 'layout'
});

Router.map(function () {
  this.route('dashboard', {
    path: '/',
    template: 'dashboard'
  });

  this.route('metrics', {
    path: '/metrics'
  });

});

function extract_options(mixpanel_url){
  exploded_url = Npm.require('url').parse(mixpanel_url, true);
  if (exploded_url.pathname != '/api/2.0/segmentation' || exploded_url.hostname != "mixpanel.com") {
    return false;
  } else {
    return _.omit(exploded_url.query, ["to_date", "from_date", "unit", "api_key", "expire", "sig"]);
  }
}

if (Meteor.isClient) {
  Meteor.startup(function(){});

  Handlebars.registerHelper('spanSplit', function(collection, options) {
    var out = '<div class="row-fluid">';
    var count = 0;

    collection.forEach(function (item) {

      out += Spark.labelBranch(Spark.UNIQUE_LABEL, function(){
        return options.fn(item, {  });
      });
      count += 1;
      if (count == 3) {
        out += '</div><div class="row-fluid">';
        count = 0;
      }
    });

    out += "</div>";
    return out;
  });

  Template.metrics.metrics = function(){
    return Metrics.find({});
  }

  Template.dashboard.metrics = function(){
    return Metrics.find({});
  }

  Template.metric.options_string = function(){
    var title = "";
    if("undefined" != typeof this.options) {
      title = this.options.event + " / " + this.options.where + " / " + this.options.type;
    }
    return title;
  }

  Template.metric.rendered = function(){

    var json = this.data.data;

    var parseDate = d3.time.format("%Y-%m-%d %H:%M:%S").parse;
    json.forEach(function(d) {
      d.date = parseDate(d.date);
    });

    var path = "#sparkline_"+this.data._id;
    var h = $(path).height(),
        w = $(path).width();
    var max=0, min=0, len=0;


    max = d3.max(json, function(o) { return d3.max([o.now, o.compare]); });

    var x = d3.time.scale().domain(d3.extent(json, function(d) { return d.date; })).range([0, w]);
    var y = d3.scale.linear().domain([0, max]).range([h, 0]);

    var line = d3.svg.line()
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d.now); });

    var area = d3.svg.area()
      .x(function(d) { return x(d.date); })
      .y0(h)
      .y1(function(d,i) { return y(d.compare); });

    var svg = d3.select(path).append("svg").attr("height", h).attr("width", w);

    var now = svg.selectAll(".now")
        .data([json])
        .enter().append("g")
        .attr("class", "now");

    now.append("path")
        .attr("class", "line")
        .attr("d", function(d) { return line(d); });

    var compare = svg.selectAll(".compare")
        .data([json])
        .enter().append("g")
        .attr("class", "compare");

    compare.append("path")
        .attr("class", "line")
        .attr("d", function(d) { return area(d); });




  // var now = svg.selectAll(".now")
  //     .data(json.now)
  //     .enter().append("g")
  //     .attr("class", "now");

  // now.append("path")
  //     .attr("class", "line")
  //     .attr("d", function(d) { return line(d.value); });

    // var g = svg.append("svg:g").data(json.now)
    //         .enter()
    //         .append("svg:path")
    //         .attr("d", function(d) {return line(d.value);})
    //         .attr("class", "now");

    // var g = svg.append("svg:g").data(json.compare)
    //         .enter()
    //         .append("svg:path")
    //         .attr("d", function(d) {return area(d.value);})
    //         .attr("class", "compare");



  }
  Template.metrics.rendered = function() {
    var _this = this;

    $(this.findAll('.live-input')).each(function(i, elem){
      $(elem).unbind("keyup").keyup(function(e){
        var o     = {},
            id    = $(this).data("objectid"),
            prop  = $(this).data("prop"),
            val   = e.target.value;
        o[prop]   = val;
        Metrics.update({_id: id}, {$set: o});
      });
    });
  }

  Template.metrics.events({
    'click .addMetric' : function(e) {
      e.preventDefault();
      Metrics.insert({});
    },
    'click .removeMetric': function(e){
      e.preventDefault();
      if ($(e.target).hasClass("confirm")) {
        Metrics.remove({_id: this._id});
      } else {
        $(e.target).addClass("confirm btn-red").removeClass("btn-default");
        $(e.target).find("i").addClass("icon-question-sign").removeClass("icon-remove");
      }
    },
  });

  Template.dashboard.events({
    'click .refresh' : function(e) {
      e.preventDefault();
      Meteor.call("fetchMetrics");
    }
  });

}



if (Meteor.isServer) {

  //move to env settings
  var mixpanel_settings = {
    key: "xxx",
    secret: "xxx"
  }

  Date.prototype.yyyymmdd = function() {
    var yyyy = this.getFullYear().toString();
    var mm   = (this.getMonth()+1).toString();
    var dd   = this.getDate().toString();
    return yyyy + "-" + (mm[1]?mm:"0"+mm[0]) + "-"  + (dd[1]?dd:"0"+dd[0]);
  };

  var fetch_metrics_data = function () {
    Meteor.call("fetchMetrics");
  }

  var fetch_metric = function(metric){

    var Mixpanel_Exporter = Meteor.require('node-mixpanel-data-exporter')
    var mixpanel_exporter = new Mixpanel_Exporter({
      api_key: mixpanel_settings.key,
      api_secret: mixpanel_settings.secret
    });

    mixpanel_exporter.segmentationSync = Meteor._wrapAsync(mixpanel_exporter.segmentation.bind(mixpanel_exporter));

    var basics = {
      unit: "hour"
    }

    var d = new Date();

    var now = {
      to_date: new Date().yyyymmdd(),
      from_date: new Date(d.setDate(d.getDate()-2)).yyyymmdd()
    }

    //will need to make that cleaner - weird substractions
    var compare = {
      to_date: new Date(d.setDate(d.getDate()-5)).yyyymmdd(),
      from_date: new Date(d.setDate(d.getDate()-2)).yyyymmdd()
    }

    var result = mixpanel_exporter.segmentationSync(_.extend(metric.options, basics, now));

    var data = [], data2 = [];

    res = JSON.parse(result.body);
    _.each(res.data.values, function(value, key){
      _.each(value, function(val, k){
        data.push({date:k,now:val});
      });
    });

    data = _(data).sortBy(function(datum) {
        return datum.date;
    });

    var result = mixpanel_exporter.segmentationSync(_.extend(metric.options, basics, compare));

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



    console.log(data);
    Metrics.update({_id:metric._id}, {$set: {data: data}});
  }

  Meteor.methods({
    fetchMetrics : function(){
      var metrics = Metrics.find();
      metrics.forEach(function(metric){
        if("undefined" != typeof metric.mixpanel_url) {
          if("undefined" == typeof metric.options) {
            var options;
            if(options = extract_options(metric.mixpanel_url)){
              Metrics.update({_id: metric._id}, {$set: {options: options}});
            }
          } else {
            fetch_metric(metric);
          }
        }
      });
    }
  });


  Meteor.startup(function () {
    Meteor.setInterval(fetch_metrics_data, 30 * 60 * 1000);
    fetch_metrics_data();
  });
}
