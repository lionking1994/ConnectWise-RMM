const { AppDataSource } = require('./dist/database/dataSource');
const { ApiCredential } = require('./dist/entities/ApiCredential');

async function checkCredentials() {
  try {
    await AppDataSource.initialize();
    
    const credentialRepo = AppDataSource.getRepository(ApiCredential);
    const credentials = await credentialRepo.find();
    
    console.log('\n📦 Saved Credentials in Database:');
    console.log('================================\n');
    
    credentials.forEach(cred => {
      console.log(`Provider: ${cred.provider}`);
      console.log(`Name: ${cred.name}`);
      console.log(`Active: ${cred.isActive}`);
      console.log(`Last Updated: ${cred.updatedAt}`);
      
      if (cred.credentials) {
        const data = cred.credentials;
        if (cred.provider === 'connectwise') {
          console.log('ConnectWise Settings:');
          console.log(`  - API URL: ${data.apiUrl || 'Not set'}`);
          console.log(`  - Company ID: ${data.companyId || 'Not set'}`);
          console.log(`  - Public Key: ${data.publicKey ? '***' + data.publicKey.slice(-4) : 'Not set'}`);
          console.log(`  - Private Key: ${data.privateKey ? '***' + data.privateKey.slice(-4) : 'Not set'}`);
          console.log(`  - Client ID: ${data.clientId || 'Not set'}`);
        } else if (cred.provider === 'nable') {
          console.log('N-able Settings:');
          console.log(`  - API URL: ${data.apiUrl || data.url || 'Not set'}`);
          console.log(`  - API Key: ${data.apiKey || data.accessKey ? '***' + (data.apiKey || data.accessKey).slice(-4) : 'Not set'}`);
          console.log(`  - Partner Name: ${data.partnerName || 'Not set'}`);
        }
      }
      console.log('---');
    });
    
    if (credentials.length === 0) {
      console.log('❌ No credentials found in database!');
      console.log('   Please save credentials from the Settings page.');
    }
    
    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error checking credentials:', error.message);
  }
}

checkCredentials();
