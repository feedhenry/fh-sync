node('uart-and-cloud-deploy-slave') {


    currentBuild.result = "SUCCESS"

    try {

       stage 'Checkout'

            checkout scm

       stage 'Test'

            env.NODE_ENV = "test"

            print "Environment will be : ${env.NODE_ENV}"

            sh 'node -v'
            sh 'npm install'
            sh 'npm test'
      
       stage 'Archive'
      
            sh 'grunt fh:dist'
            archive includes: 'dist/fh-mbaas-api*.tar.gz, CHANGELOG.*, dist/sha.txt'

       stage 'Cleanup'

            echo 'prune and cleanup'
            sh 'npm prune'
            sh 'rm node_modules -rf'

    }


    catch (err) {

        currentBuild.result = "FAILURE"

        throw err
    }

}