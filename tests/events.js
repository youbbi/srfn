//tests/events.js
var assert = require('assert');

suite('Events', function() {
  test('in the server', function(done, server) {
    server.eval(function() {
      Events.insert({title: 'hello title'});
      var events = Events.find().fetch();
      emit('events', events);
    });

    server.once('events', function(events) {
      assert.equal(events.length, 1);
      done();
    });
  });

  test('using both client and the server', function(done, server, client) {
    server.eval(function() {
      Events.find().observe({
        added: addedNewEvent
      });

      function addedNewEvent(event) {
        emit('event', event);
      }
    }).once('event', function(event) {
      assert.equal(event.title, 'hello title');
      done();
    });

    client.eval(function() {
      Events.insert({title: 'hello title'});
    });
  });

  test('using two client', function(done, server, c1, c2) {
    c1.eval(function() {
      Events.find().observe({
        added: addedNewEvent
      });

      function addedNewEvent(event) {
        emit('event', event);
      }
      emit('done');
    }).once('event', function(event) {
      assert.equal(event.title, 'from c2');
      done();
    }).once('done', function() {
      c2.eval(insertEvent);
    });

    function insertEvent() {
      Events.insert({title: 'from c2'});
    }
  });

});