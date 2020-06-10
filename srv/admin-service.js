const cds = require('@sap/cds')
const { OrderItems } = cds.entities

/** Service implementation for CatalogService */
module.exports = cds.service.impl(function () {
    this.after('READ', 'Orders', async (orders) => {
        for (let each of orders) {
            const items = await SELECT.from(OrderItems,[ 'amount', 'netAmount']).where({ PARENT_ID: each.ID });
            let total = 0;
            items.forEach(items => {
                total = total + (items.amount * items.netAmount);
            })
            each.total = total;
        }
    }) 

    this.on('payment',  async (req) => {
        const order = await SELECT.one.from(cds.entities.Orders).where({ ID: req.data.orderID});
        
        if(order == null || order == undefined)
        {
            req.error (409, `Invalid OrderID `)
        }
        if(order.status === 'paid')
        {
            req.error (409, `Already Paid`)
        }
        cds.transaction(req).run( UPDATE(cds.entities.Orders).set({status:'paid',paymentDate: Date.now()}).where({ ID: req.data.orderID}))
        req.info('201','Order Update with Payment Information')
    })

})