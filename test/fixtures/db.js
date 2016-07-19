var nock = require('nock');
var dbReplies = {
  create : function(path, body){
    return { type: 'myFirstEntity',
      guid: '5202699a891b400e59000001',
      fields:
      { firstName: 'Joe',
        lastName: 'Bloggs',
        address1: '22 Blogger Lane',
        address2: 'Bloggsville',
        country: 'Bloggland',
        phone: '555-123456' } };
  },
  list : function(){
    return { count: 1,
      list:
        [ { type: 'myFirstEntity',
          guid: '520269c9891b400e59000002',
          fields:
          { firstName: 'Joe',
            lastName: 'Bloggs',
            address1: '22 Blogger Lane',
            address2: 'Bloggsville',
            country: 'Bloggland',
            phone: '555-123456' } }
        ]
    };
  },
  read : function(){
    return { type: 'myFirstEntity',
    guid: '52026a18891b400e59000003',
    fields:
      { firstName: 'Joe',
      lastName: 'Bloggs',
      address1: '22 Blogger Lane',
      address2: 'Bloggsville',
      country: 'Bloggland',
      phone: '555-123456' } };
  },
  update : function(){
    return { type: 'myFirstEntity',
      guid: '52026a3b891b400e59000004',
      fields: { fistName: 'Jane' } };
  },
  delete : function(){
    return { type: 'myFirstEntity',
      guid: '52026a57891b400e59000005',
      fields: { fistName: 'Jane' } };
  },
  import : function(path, body){
    return body;
  }
};

module.exports = nock('https://localhost:8802')
.filteringRequestBody(function(path) {
  return '*';
})
.post('/data/create', '*')
.reply(200, dbReplies.create)
.post('/data/list', '*')
.reply(200, dbReplies.list)
.post('/data/read', '*')
.reply(200, dbReplies.read)
.post('/data/update', '*')
.reply(200, dbReplies.update)
.post('/data/delete', '*')
.reply(200, dbReplies.delete)
.post('/data/import', '*')
.reply(200, dbReplies.import)
.post('/data/export', '*')
.replyWithFile(200, __dirname + '/dbexport.zip');
