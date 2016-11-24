var nock = require('nock');

var replies = {
  verifysession : function(path, body){
    return {
      isValid: true
    }
  },
  
  /**
   * @param  {String} path
   * @param  {String} body
   */
  productionMode: function (path, body) {
    return 'productionMode';
  }
};
module.exports = nock('https://localhost:443')
.filteringRequestBody(function(path) {
  return '*';
})
.post('/box/srv/1.1/admin/authpolicy/verifysession', '*')
.reply(200, replies.verifysession)
.post('/box/srv/1.1/admin/authpolicy/auth', '*')
.reply(200, replies.productionMode)
