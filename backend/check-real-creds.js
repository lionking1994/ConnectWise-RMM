const { AppDataSource } = require('./dist/database/dataSource');
const { ApiCredential } = require('./dist/entities/ApiCredential');

async function checkCredentials() {
  try {
    await AppDataSource.initialize();
    
    const credentialRepo = AppDataSource.getRepository(ApiCredential);
    const credentials = await credentialRepo.find();
    
    console.log('\n📦 Your Saved Credentials:');
    console.log('=========================\n');
    
    credentials.forEach(cred => {
      if (cred.provider === 'connectwise') {
        const data = cred.credentials;
        console.log('🔹 ConnectWise:');
        console.log(`  API URL: ${data.apiUrl || 'Not set'}`);
        console.log(`  Company ID: ${data.companyId || 'Not set'}`);
        console.log(`  Public Key: ${data.publicKey || 'Not set'}`);
        console.log(`  Private Key: ${data.privateKey ? data.privateKey.substring(0, 4) + '...' + data.privateKey.slice(-4) : 'Not set'}`);
        console.log(`  Client ID: ${data.clientId || 'Not set'}`);
        console.log(`  Active: ${cred.isActive}`);
        console.log(`  Last Updated: ${cred.updatedAt}`);
      } else if (cred.provider === 'nable') {
        const data = cred.credentials;
        console.log('\n🔹 N-able:');
        console.log(`  API URL: ${data.apiUrl || data.url || 'Not set'}`);
        console.log(`  API Key: ${data.apiKey || data.accessKey || 'Not set'}`);
        console.log(`  Active: ${cred.isActive}`);
        console.log(`  Last Updated: ${cred.updatedAt}`);
      }
    });
    
    console.log('\n📝 Expected Values (from your input):');
    console.log('=====================================');
    console.log('ConnectWise:');
    console.log('  URL: https://api-na.myconnectwise.net/v4_6_release/apis/3.0/');
    console.log('  Company: Somos');
    console.log('  Public: jSPLwWW1zDjO7i08');
    console.log('  Private: KH1S...GHb7');
    console.log('  Client: 0ea93dc0-6921-4d58-919a-4433616ef054');
    console.log('\nN-able:');
    console.log('  URL: https://www.systemmonitor.us/api');
    console.log('  Key: 5232f3bf28767776bbf7346a42d69450');
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkCredentials();
