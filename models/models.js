Metrics = new Meteor.Collection('metric');
Metrics.allow({
  insert: function () {
    return !Meteor.settings.demo;
  },
  update: function () {
    return !Meteor.settings.demo;
  },
  remove: function () {
    return !Meteor.settings.demo;
  }
});
