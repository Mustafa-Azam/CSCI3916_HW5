let envPath = __dirname + "/../.env";
require('dotenv').config({ path: envPath });
let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../server');
let User = require('../Users');
chai.should();

chai.use(chaiHttp);

let login_details = {
    name: 'test',
    username: 'email@email.com',
    password: '123@abc'
};

describe('Register, Login User', () => {
    beforeEach(async () => { // Make beforeEach async
        try {
            await User.deleteOne({ name: 'test' }); // Use await
        } catch (error) {
            console.error("Error in beforeEach:", error);
            throw error; // Re-throw to fail the test if cleanup fails
        }
    });

    after(async () => { // Make after async
        try {
            await User.deleteOne({ name: 'test' }); // Use await
        } catch (error) {
            console.error("Error in after:", error);
            throw error; // Re-throw to fail the test if cleanup fails
        }
    });

    describe('/signup', () => {
        it('it should register, login and check our token', async () => {
            const signupRes = await chai.request(server)
                .post('/signup')
                .send(login_details);
                
            signupRes.should.have.status(201);
            signupRes.body.success.should.be.eql(true);
    
            const signinRes = await chai.request(server)
                .post('/signin')
                .send(login_details);
                
            signinRes.should.have.status(200);
            signinRes.body.should.have.property('token');
            
            // Store token if needed
            let token = signinRes.body.token;
        });
    });
});