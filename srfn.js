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

if (Meteor.isClient) {

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
  };

  Template.dashboard.metrics = function(){
    return Metrics.find({ data: { $exists: true }, options: { $exists: true } });
  };

  Template.metric.options_string = function(){
    //use a whitelist for properties to display instead of fixed values
    return this.options.event + " / " + this.options.where + " / " + this.options.type;
  };

  Template.metric.rendered = function(){
    var _this = this;
    var json = this.data.data;

    var parseDate  = d3.time.format("%Y-%m-%d %H:%M:%S").parse;
    var formatDate = d3.time.format("%b %d @ %I%p");
    json.forEach(function(d) {
      d.date = parseDate(d.date);
    });

    var path = "#sparkline_"+this.data._id;
    var h = $(path).height(), w = $(path).width();
    var max=d3.max(json, function(o) { return d3.max([o.now, o.compare]); });
    var x = d3.time.scale().domain(d3.extent(json, function(d) { return d.date; })).range([0, w]);
    var y = d3.scale.linear().domain([0, max]).range([h, 0]);
    var svg = d3.select(path).append("svg").attr("height", h).attr("width", w);

    var line = d3.svg.line()
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d.now); });

    var area = d3.svg.area()
      .x(function(d) { return x(d.date); })
      .y0(h)
      .y1(function(d,i) { return y(d.compare); });

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

    //line visibility cycling.
    _this.cycle_counter = 0;

    $(this.findAll('.sparkline')).each(function(i, elem){
      $(elem).unbind("click").click(function(e){
        _this.cycle_counter++;
        var $p = $(e.target).closest(".sparkline");
        var cycle_list = {"now":[true,true,false],"compare":[true,false,true]};
        $p.find(".now").toggle(cycle_list.now[_this.cycle_counter % 3]);
        $p.find(".compare").toggle(cycle_list.compare[_this.cycle_counter % 3]);
      });
    });

    //circles and text elements to show hover value
    var focus1 = svg.append("g")
        .attr("class", "focus")
        .style("display", "none");

    var focus2 = svg.append("g")
        .attr("class", "focus")
        .style("display", "none");

    focus1.append("circle")
        .attr("r", 2);

    focus2.append("circle")
        .attr("r", 2);

    var linetip = svg.append("text")
        .attr("x", 0)
        .attr("dy", h-30)
        .attr("alignment-baseline", "middle")
        .attr("class", "linetip");

    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", w)
        .attr("height", h)
        .on("mouseover", function() { focus1.style("display", null); focus2.style("display", null); linetip.style("display", null); })
        .on("mouseout", function() { focus1.style("display", "none"); focus2.style("display", "none"); linetip.style("display", "none"); })
        .on("mousemove", mousemove);

    var bisectDate = d3.bisector(function(d) { return d.date; }).left;

    function mousemove() {
      var x0 = x.invert(d3.mouse(this)[0]),
          i = bisectDate(json, x0, 1),
          d0 = json[i - 1],
          d1 = json[i],
          d = x0 - d0.date > d1.date - x0 ? d1 : d0;
      focus1.attr("transform", "translate(" + x(d.date) + "," + y(d.now) + ")");
      focus2.attr("transform", "translate(" + x(d.date) + "," + y(d.compare) + ")");
      linetip.text(formatDate(d.date).toLowerCase() + " => now: " + d.now + " vs " + d.compare);
    }
  };

  Template.metrics.rendered = function() {
    var _this = this;

    $(this.findAll('.live-input')).each(function(i, elem){
      $(elem).unbind("keyup").keyup(function(e){
        var o     = {},
            id    = $(this).data("objectid"),
            prop  = $(this).data("prop"),
            val   = e.target.value;
        o[prop]   = val;
        Metrics.update({_id: id}, {$set: o}, function(err,res){
          Meteor.call("parseOptions", id);
        });
      });
    });
  };

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
        $(e.target).addClass("confirm btn-danger").removeClass("btn-warning");
        $(e.target).find("i").addClass("icon-question-sign").removeClass("icon-remove");
      }
    },
  });
}

if (Meteor.isServer) {

  var extract_options = function(mixpanel_url){
    exploded_url = Npm.require('url').parse(mixpanel_url, true);
    if (exploded_url.pathname != '/api/2.0/segmentation' || exploded_url.hostname != "mixpanel.com") {
      return false;
    } else {
      return _.omit(exploded_url.query, ["to_date", "from_date", "unit", "api_key", "expire", "sig"]);
    }
  };

  var fetch_metrics_data = function () {
    Meteor.call("fetchMetrics");
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
    fetchMetrics : function(){
      var metrics = Metrics.find();
      metrics.forEach(function(metric){
        if("undefined" != typeof metric.mixpanel_url && "undefined" != typeof metric.options) {
          fetch_metric(metric);
        }
      });
    },
    parseOptions: function(id){
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
  });

  Meteor.startup(function () {
    Meteor.setInterval(fetch_metrics_data, 2 * 60 * 1000);
  });
}
