//tests/metrics.js
var assert = require('assert');

suite('Metrics', function() {
  test('in the server', function(done, server) {
    server.eval(function() {
      Metrics.insert({mixpanel_url: 'https://mixpanel.com/'});
      var metrics = Metrics.find().fetch();
      emit('metrics', metrics);
    });

    server.once('metrics', function(metrics) {
      assert.equal(metrics.length, 1);
      done();
    });
  });

  test('using both client and the server', function(done, server, client) {
    server.eval(function() {
      Metrics.find().observe({
        added: addedNewEvent
      });

      function addedNewEvent(event) {
        emit('event', event);
      }
    }).once('event', function(event) {
      assert.equal(event.mixpanel_url, 'https://mixpanel.com/');
      done();
    });

    client.eval(function() {
      Metrics.insert({mixpanel_url: 'https://mixpanel.com/'});
    });
  });

  test('using two clients', function(done, server, c1, c2) {
    c1.eval(function() {
      Metrics.find().observe({
        added: addedNewEvent
      });

      function addedNewEvent(metric) {
        emit('metric', metric);
      }
      emit('done');
    }).once('metric', function(metric) {
      assert.equal(metric.mixpanel_url, 'https://mixpanel.com/c2');
      done();
    }).once('done', function() {
      c2.eval(insertEvent);
    });

    function insertEvent() {
      Metrics.insert({mixpanel_url: 'https://mixpanel.com/c2'});
    }
  });

});
