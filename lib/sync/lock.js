// TODO Use mongodb for locking via https://github.com/chilts/mongodb-lock
// TODO when using https://github.com/chilts/mongodb-lock, ensure old locks are removed



module.exports = function() {
  return {
    /**
     * Acquire the lock with the given name.
     * @param {String} lockName the name of the lock
     * @param {Number} ttl Time to live on the lock
     * @param {Function} callback
     */
    acquire: function() {
      return {
        //allow extend the ttl of the lock
        extend: function() {

        },
        //release the lock
        release: function() {

        }
      };
    }
  };
};