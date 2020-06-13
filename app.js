const express = require('express')
const bodyParser = require('body-parser')
const app = express()

//Here we are configuring express to use body-parser as middle-ware for rest services only.
//app.use(bodyParser.urlencoded({ extended: false }));
//app.use(bodyParser.json());
var jsonParser = bodyParser.json();


const { PORT = 4004 } = process.env
const cds = require('@sap/cds')

// add security handling via passport
/*var passport = require("passport");
var xssec = require("@sap/xssec"); 
var xsenv = require("@sap/xsenv");
passport.use("JWT", new xssec.JWTStrategy(xsenv.getServices({
	uaa: {
		tag: "xsuaa"
	}
}).uaa));

app.use(passport.initialize());
app.use(passport.authenticate("JWT", {
	session: false
}));*/

initcds(app);
initdrmapi(app);
app.get('/', (req, res) => res.send('Welcome to Data Retention Manager Demo !!!'))


app.listen(PORT, () => console.log(`Example app listening at http://localhost:${PORT}`))

async function initcds(app) {
    // await cds.connect.to ('db');
    const options = {
        "in_memory": false,
        "service": 'all',
        "from": '*',
        "app": app
    }
    const model = cds.model = await cds.load(options.from)
    // bootstrap --in-memory db if requested
    if (options.in_memory) cds.db = await cds.deploy(model, options)

    // connect to primary database if required
    else if (cds.requires.db) cds.db = await cds.connect.to('db')


    await cds.serve(options).from(model).in(app);
}

async function initdrmapi(app) {

    /** Find list of legal entities in the system for corresponding data subject role, 
     * it is used by retention manager to provide value list help to business user duriing 
     * business purpose maintenance. Data subject based URL + value legal entity value help end point. */

    app.get('/drm/legalEntities/:dataSubjectRole', async (req, res) => {
        console.log("Data Subject Role: " + req.params.dataSubjectRole)

        const legalEntities = [];
        let dbLegalEntities = [];
        try {
            dbLegalEntities = await cds.read('sap.capire.bookshop.LegalEntities').where({ role: req.params.dataSubjectRole })
        }
        catch (e) {
            console.log(e);
        }
        for (let each of dbLegalEntities) {
            const legalEnties = {
                "value": each.ID,
                'valueDesc': each.description
            }
            legalEntities.push(legalEnties)
        }

        console.log("Response:" + JSON.stringify(legalEntities));
        res.send(legalEntities)
    })

    /** List of conditional values for corresponding conditional field name. */
    app.get('/drm/conditionalFieldValues/:conditionFieldName', (req, res) => {
        console.log("DConditionFieldName : " + req.params.conditionFieldName)
        const legalEnties = {
            "value": "1010",
            'valueDesc': "Europe Company"
        }
        console.log("Response:" + JSON.stringify([legalEnties]));
        res.send([legalEnties])
    })

    /** API to check whether data subject has reached end of Business or not. 
     * If data subject has ongoing active business or not. */

    app.post('/drm/dataSubjectEndofBusiness', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log("Request dataSubjectEndofBusiness:"+ JSON.stringify(reqBody));
        let reply = {
            "dataSubjectExpired": true,
            "dataSubjectNotExpiredReason": ""
        }
        try {
            if (reqBody.dataSubjectRole === 'Customer' && reqBody.legalGround === 'Order') {
                let orders = []
                orders = await SELECT.from('AdminService.Orders').where({ customer_ID: Number(reqBody.dataSubjectID) })
                if (orders.length === 0) {
                    res.status(204).send();
                    return;
                }
                else {
                    for (let each of orders) {
                        if (each.paymentDate === null) {
                            reply.dataSubjectExpired = false
                            reply.dataSubjectNotExpiredReason = 'Orders are still not paid'
                            res.status(200).send(reply);
                            return;
                        }
                    }
                    console.log("Response dataSubjectEndofBusiness:" + JSON.stringify(reply));
                    res.status(200).send(reply);
                }

            }
        } catch (e) {
            console.log(e);
        }
    })

    /** API to get data subject legal entities. Legal entities in which he is taking part in */
    app.post('/drm/dataSubjectLegalEntities', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log("Request dataSubjectLegalEntities:"+ JSON.stringify(reqBody));
        let reply = []
        try {
            if (reqBody.dataSubjectRole === 'Customer' && reqBody.legalGround === 'Order') {
                const legalEntity = await SELECT.one.from('AdminService.Customers', ['legalEntity']).where({ ID: Number(reqBody.dataSubjectID) })
                if (legalEntity === null) {
                    return res.status(204).send()
                }
                reply.push(legalEntity);
            }
            console.log("Response dataSubjectLegalEntities:" + JSON.stringify(reply));
            return res.status(200).send(reply);

        } catch (e) {
            console.log(e);
        }
    })
    
    /** API to get data subject legal ground greatest end of business date based on reference date field startTime. 
     * Here for each legal entity return by legal ground, iteration of legal entity retention rule call will happen. */

    app.post('/drm/dataSubjectRetentionStartDate', jsonParser, async (req, res) => {
        try {
        console.log("Request dataSubjectRetentionStartDate:"+ req);
        const reqBody = req.body
        let reply = []
            console.log("Role:"+ reqBody.dataSubjectRole);
            console.log("dataSubjectID:"+ reqBody.dataSubjectID);
            if (reqBody.dataSubjectRole === 'Customer') {
                const orders = await SELECT.from('AdminService.Orders').where({ customer_ID: Number(reqBody.dataSubjectID) })
                if (orders.length === 0) {
                    return res.status(204).send();
                }
                else {
                    let retentionDate = null;
                    for (let each of orders) {
                        console.log("startTime:"+ each[reqBody.startTime]);
                        if (each[reqBody.startTime] === null) {
                            return res.status(204).send();
                        }
                        else {
                            let resiDate = new Date(retentionDate),
                                orderpayDate = new Date(each[reqBody.startTime]);
                            if (retentionDate === null || resiDate < orderpayDate)
                                retentionDate = each[reqBody.startTime]
                        }
                    }
                    const retentionmsg = {
                        "retentionID": reqBody.rulesConditionSet[0].retentionID,
                        "retentionStartDate": retentionDate.substring(0,19)
                    }
                    reply.push(retentionmsg)
                    console.log("Request dataSubjectRetentionStartDate2:"+ reqBody);
                    console.log("Response dataSubjectRetentionStartDate:" + JSON.stringify(reply));
                    return res.status(200).send(reply);
                }
            }
        } catch (e) {
            console.log(e);
        }
    })

    /** API to get data subjects which have reached end of residence. */
    app.post('/drm/endofResidenceDataSubject', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log("Request endofResidenceDataSubject:"+ JSON.stringify(reqBody));
        const transcation = cds.transaction(req);
        let customerStillValid = [];
        let customerNotUsed = [];
        let reply = {
            "success": []
        }
        try {
            if (reqBody.dataSubjectRole === 'Customer') {
                for (let each of reqBody.legalEntitiesResidenceRules) {
                    const orders = await transcation.run(SELECT.from('AdminService.Orders').
                        where({ customer_ID: SELECT.from('AdminService.Customers', ['ID']).where({ legalEntity: each.legalEntity }) }))

                    for (let order of orders) {
                        if (customerStillValid.indexOf(order.customer_ID) < 0) {
                            let payDate = new Date(order.paymentDate),
                                resiDate = new Date(each.residenceRules[0].residenceDate);
                            if (order.paymentDate === null || payDate > resiDate) { /// not paid or paymentDate is grater than residence Date
                                customerStillValid.push(order.customer_ID);
                                customerNotUsed = customerNotUsed.filter(item => item !== order.customer_ID)  // remove valid Customer from Customer Not Used Array

                            }
                            else if (customerNotUsed.indexOf(order.customer_ID) < 0) {
                                customerNotUsed.push(order.customer_ID);
                            }
                        }
                    }
                }
                for (let customer of customerNotUsed) {
                    const cust = { "dataSubjectID": customer }
                    reply.success.push(cust);
                }
                console.log("Response endofResidenceDataSubject:" + JSON.stringify(reply));
                return res.status(200).send(reply)
            }
        } catch (e) {
            console.log(e);
        }
    })

    /**API to get data subject information. */
    app.post('/drm/dataSubjectInformation', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log("Request dataSubjectInformation:"+ JSON.stringify(reqBody));
        let reply = []
        try {
            if (reqBody.dataSubjectRole === 'Customer') {
                const customers = await SELECT.from('AdminService.Customers', ['ID', 'name']).where({ ID: reqBody.dataSubjectIds })
                for (let customer of customers) {
                    let custData = {
                        "dataSubjectId": (customer.ID).toString(),
                        "name": customer.name,
                        "emailId": ""
                    }
                    reply.push(custData);
                }
            }
            console.log("Response dataSubjectInformation:" + JSON.stringify(reply));
            return res.status(200).send(reply);
        } catch (e) {
            console.log(e);
        }
    })

  /** API to blocking legal ground instances */
    app.post('/drm/deleteDSLegalGroundInstances', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log("Request deleteDSLegalGroundInstances:"+ JSON.stringify(reqBody));
        try {
            if (reqBody.dataSubjectRole === 'Customer') {
                const update = await UPDATE('sap.capire.bookshop.Orders').set({ isBlocked: true, maxDeletionDate: reqBody.maxDeletionDate }).where({ customer_ID: reqBody.dataSubjectID })
                if (update > 0) return res.status(200).send();
            }
            return res.status(500).send();
        } catch (e) {
            console.log(e);
            return res.status(500).send();
        }
    })

    /** API to block data subject. */
    app.post('/drm/deleteDataSubject', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log("Request deleteDataSubject:"+ JSON.stringify(reqBody));
        try {
            if (reqBody.dataSubjectRole === 'Customer') {
                const update = await UPDATE('sap.capire.bookshop.Customers').set({ isBlocked: true, maxDeletionDate: reqBody.maxDeletionDate }).where({ ID: reqBody.dataSubjectID })
                if (update > 0) return res.status(200).send();
            }
            return res.status(500).send();
        } catch (e) {
            console.log(e);
            return res.status(500).send();
        }
    })

    /** API to destroy blocked legal ground instances which reached end of retention period */
    app.post('/drm/destroyLegalGroundInstances', jsonParser, async (req, res) => {
        const reqBody = req.body
       console.log("Request destroyLegalGroundInstances:"+ JSON.stringify(reqBody));
        try {
            const todate = (new Date()).toISOString();
            if (reqBody.dataSubjectRole === 'Customer' && reqBody.legalGround === 'Order') {
                await DELETE('sap.capire.bookshop.Orders').where({ maxDeletionDate: { '<': todate } }) /// CDS check for complex where 
                return res.status(202).send();
            }

        } catch (e) {
            console.log(e);
            return res.status(500).send(e);
        }
    })

    /** API to destroy blocked data subject which reached end of retention period. */
    app.post('/drm/destroyDataSubjects', jsonParser, async (req, res) => {
        const reqBody = req.body
        console.log("Request destroyDataSubjects:"+ JSON.stringify(reqBody));
        try {
            const todate = (new Date()).toISOString();
            if (reqBody.dataSubjectRole === 'Customer') {
                await DELETE('sap.capire.bookshop.Customers').where({ maxDeletionDate: { '<': todate } }) /// CDS check for complex where 
                return res.status(202).send();
            }

        } catch (e) {
            console.log(e);
            return res.status(500).send(e);
        }
    })


}


