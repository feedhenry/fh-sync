// Sample data source returned by list handler
// In real world use cases this module will fetch data from database.
var data = {
    '00001': {
      'item': 'item1'
    },
    '00002': {
      'item': 'item2'
    },
    '00003': {
      'item': 'item3'
    }
  }

var datalistHandler = function (dataset_id, query_params, meta_data, cb) {
  console.log('listing items for dataset "%s"', dataset_id);
  return cb(null, data);
}

module.exports = {
  list: datalistHandler
};
