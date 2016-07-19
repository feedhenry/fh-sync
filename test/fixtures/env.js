module.exports = (function(){
  process.env.FH_TEST_HOSTNAME = "http://localhost:3000";

  process.env.FH_MBAAS_HOST = "mbaas.mbaas1.feedhenry.com";
  process.env.FH_MBAAS_PROTOCOL = "https";
  process.env.FH_MBAAS_ENV_ACCESS_KEY = "keytoaccessmbaasenv";
  process.env.FH_APP_API_KEY = "someappapikey";

  process.env.FH_MILLICORE = 'localhost';
  process.env.FH_DOMAIN = 'NO-DOMAIN-DEFINED';
  process.env.FH_INSTANCE = 'c0TPJzF6ztq0WjezxwPEC5W8';
  process.env.FH_APPNAME = '123';
  process.env.FH_WIDGET = 'c0TPJzF6ztq0W12345PEC5W8';
  process.env.FH_DITCH_HOST = 'localhost';
  process.env.FH_DITCH_PORT = 8802;
  process.env.FH_DOMAIN_DATABASE = "mongodb://127.0.0.1:27017/testdb";
  process.env.FH_ENV = "dev";
  process.env.FH_URBAN_AIRSHIP = JSON.stringify({
    "ua_push_enabled" : true,
    "ua_push_dev_app_key" : '9z95CMpCTLavGrgga-SYPA',
    "ua_push_dev_app_secret" : 'FpF3-38lQteTQcTRYhtcGg',
    "ua_push_dev_master_secret" : 'STS8wrN8QzyHKxm7PM953w',
    "ua_push_prod_app_key" : '',
    "ua_push_prod_app_secret_key" : '',
    "ua_push_prod_app_master_secret_key" : ''
  });
})();