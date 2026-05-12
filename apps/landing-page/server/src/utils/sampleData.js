export const sampleUsers = [
  {
    name: "Operations Manager",
    email: "ops@choicemecourier.com",
    password: "ChoiceMe@123",
    role: "admin",
    phone: "9906690088",
    company: "ChoiceMe Courier",
  },
  {
    name: "Dispatch Analyst",
    email: "dispatch@choicemecourier.com",
    password: "ChoiceMe@123",
    role: "manager",
    phone: "9906690088",
    company: "ChoiceMe Courier",
  },
];

export function buildSampleShipments(userId) {
  return [
    {
      trackingId: "CMC78254019",
      orderId: "ORD-11892",
      customerName: "Sana Mir",
      contactPhone: "9797001122",
      originPincode: "193123",
      destinationPincode: "190001",
      destinationCity: "Srinagar",
      courierPartner: "Delhivery Surface",
      paymentType: "COD",
      weight: 1.8,
      dimensions: { length: 32, breadth: 24, height: 18 },
      price: 168,
      etaDays: 2,
      currentStatus: "Out for delivery",
      createdBy: userId,
      timeline: [
        {
          key: "placed",
          title: "Order placed",
          note: "Shipment booked on the ChoiceMe dashboard",
          location: "Baramulla Hub",
          time: new Date("2026-04-09T09:12:00+05:30"),
        },
        {
          key: "dispatched",
          title: "Dispatched",
          note: "Parcel transferred to primary linehaul network",
          location: "Baramulla Dispatch Center",
          time: new Date("2026-04-09T12:20:00+05:30"),
        },
        {
          key: "transit",
          title: "In transit",
          note: "Shipment is moving through the north region route",
          location: "Srinagar Gateway",
          time: new Date("2026-04-09T21:45:00+05:30"),
        },
      ],
    },
    {
      trackingId: "CMC11984027",
      orderId: "ORD-10478",
      customerName: "Aman Gupta",
      contactPhone: "9811155512",
      originPincode: "110001",
      destinationPincode: "201301",
      destinationCity: "Noida",
      courierPartner: "Blue Dart Express",
      paymentType: "Prepaid",
      weight: 0.9,
      dimensions: { length: 24, breadth: 18, height: 12 },
      price: 214,
      etaDays: 1,
      currentStatus: "Delivered",
      createdBy: userId,
      timeline: [
        {
          key: "placed",
          title: "Order placed",
          note: "Shipment registered through the seller control panel",
          location: "Delhi NCR Fulfillment",
          time: new Date("2026-04-07T08:02:00+05:30"),
        },
        {
          key: "dispatched",
          title: "Dispatched",
          note: "Picked and manifested for express movement",
          location: "Delhi Sorting Hub",
          time: new Date("2026-04-07T11:40:00+05:30"),
        },
        {
          key: "delivered",
          title: "Delivered",
          note: "Customer accepted the parcel",
          location: "Noida Sector 62",
          time: new Date("2026-04-08T14:36:00+05:30"),
        },
      ],
    },
  ];
}

export function buildSampleTransactions(shipments) {
  return shipments.map((shipment, index) => ({
    shipment: shipment._id,
    transactionId: `TXN-202604-${index + 101}`,
    amount: shipment.price,
    method: shipment.paymentType === "COD" ? "cash" : "upi",
    type: shipment.paymentType === "COD" ? "cod" : "prepaid",
    status: "completed",
  }));
}

export const sampleContacts = [
  {
    name: "Valley Home Studio",
    email: "founder@valleyhome.example",
    phone: "9876543210",
    company: "Valley Home Studio",
    message: "Looking for multi-courier pricing for Jammu & Kashmir outbound shipments.",
    source: "landing-page",
  },
];
