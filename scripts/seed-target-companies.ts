/**
 * Seeds target_companies from the curated FlytBase peer/talent-pool CSV.
 *
 * Usage:
 *   npx tsx scripts/seed-target-companies.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// CSV data (columns: #, category, name, linkedin_url, website, size_range,
//                    hq_city, hq_country, role_relevance, why_similar)
// Row 0 is header — skipped below.
// ---------------------------------------------------------------------------
const RAW = `#,Category,Company Name,LinkedIn URL,Website,Size Range,HQ City,HQ Country / Region,Role Relevance,Why Similar to FlytBase
1,Drone & UAV - India,ideaForge Technology,https://www.linkedin.com/company/ideaforge-technology/,ideaforge.com,201-500,Mumbai,India,"Engineering, Product, GTM",Leading Indian drone manufacturer; direct competitor/peer
2,Drone & UAV - India,Garuda Aerospace,https://www.linkedin.com/company/garuda-aerospace/,garudaaerospace.com,201-500,Chennai,India,"Engineering, GTM",Drone-as-a-service; similar B2B model
3,Drone & UAV - India,Throttle Aerospace Systems,https://www.linkedin.com/company/throttle-aerospace-systems/,throttleaero.com,51-200,Bengaluru,India,Engineering,Autonomous systems; similar tech stack
4,Drone & UAV - India,ePlane Company,https://www.linkedin.com/company/eplane-company/,theeplanecompany.com,51-200,Chennai,India,"Engineering, Product",Electric air mobility; deep tech India
5,Drone & UAV - India,Detect Technologies,https://www.linkedin.com/company/detect-technologies/,detect.ai,201-500,Chennai,India,"Engineering, GTM",Industrial AI + drones; enterprise B2B
6,Drone & UAV - India,Asteria Aerospace,https://www.linkedin.com/company/asteria-aerospace/,asteria.co.in,51-200,Bengaluru,India,"Engineering, Product",Drone solutions provider; similar stage
7,Drone & UAV - India,Skylark Drones,https://www.linkedin.com/company/skylark-drones/,skylarkdrones.com,51-200,Bengaluru,India,"Engineering, GTM",Drone data analytics platform
8,Drone & UAV - India,General Aeronautics,https://www.linkedin.com/company/general-aeronautics/,generalaeronautics.com,51-200,Bengaluru,India,Engineering,Agricultural drones; India HQ
9,Drone & UAV - India,IoTechWorld Avigation,https://www.linkedin.com/company/iotechworld-avigation/,iotechworld.com,51-200,Gurugram,India,"Engineering, GTM",Agricultural drone platform
10,Drone & UAV - India,Marut Dronetech,https://www.linkedin.com/company/marut-dronetech/,marutdronetech.com,51-200,Hyderabad,India,Engineering,Agricultural drones; India HQ
11,Drone & UAV - India,TechEagle,https://www.linkedin.com/company/techeagle/,techeagle.in,51-200,Gurugram,India,"Engineering, Ops",Drone delivery; India-first
12,Drone & UAV - India,Drona Aviation,https://www.linkedin.com/company/drona-aviation/,dronaaviation.com,11-50,Pune,India,Engineering,Drone education kits; India HQ
13,Drone & UAV - India,Aarav Unmanned Systems,https://www.linkedin.com/company/aarav-unmanned-systems/,aaravuas.com,11-50,Ahmedabad,India,Engineering,Survey drones; India HQ
14,Drone & UAV - India,Quidich Innovation Labs,https://www.linkedin.com/company/quidich/,quidich.com,11-50,Mumbai,India,"Engineering, GTM",Broadcast drones; India HQ
15,Drone & UAV - India,Omnipresent Robot Tech,https://www.linkedin.com/company/omnipresent-robot-tech/,omnirobo.com,51-200,Noida,India,Engineering,Robotics/drone; India HQ
16,Drone & UAV - India,NewSpace Research and Technologies,https://www.linkedin.com/company/newspace-research-and-technologies/,newspaceindia.com,51-200,Bengaluru,India,Engineering,Aerospace and drones; deep tech India
17,Drone & UAV - India,Raphe mPhibr,https://www.linkedin.com/company/raphe-mphibr/,raphe.in,11-50,Noida,India,Engineering,Fixed-wing drones; India HQ
18,Drone & UAV - India,Tata Advanced Systems,https://www.linkedin.com/company/tata-advanced-systems-limited/,tataadvancedsystems.com,1001-5000,Hyderabad,India,Engineering,Defence/aerospace manufacturing; India
19,Drone & UAV - India,Adani Defence & Aerospace,https://www.linkedin.com/company/adani-defence-aerospace/,adani.com,1001-5000,Ahmedabad,India,Engineering,Defence/aerospace; India HQ
20,Drone & UAV - India,Data Patterns India,https://www.linkedin.com/company/data-patterns-india/,datapatternsindia.com,201-500,Chennai,India,Engineering,Defence electronics; India HQ
21,Drone & UAV - Global,DJI,https://www.linkedin.com/company/dji-technology/,dji.com,10001+,Shenzhen,China,"Engineering, Product",World's largest drone company; key talent source
22,Drone & UAV - Global,Skydio,https://www.linkedin.com/company/skydio/,skydio.com,501-1000,"San Mateo, CA",USA,"Engineering, Product, GTM",AI-powered autonomous drones; direct peer
23,Drone & UAV - Global,Parrot,https://www.linkedin.com/company/parrot/,parrot.com,501-1000,Paris,France,"Engineering, Product",Enterprise drone hardware and software
24,Drone & UAV - Global,Wingcopter,https://www.linkedin.com/company/wingcopter/,wingcopter.com,201-500,Weiterstadt,Germany,Engineering,Delivery drones; global operations
25,Drone & UAV - Global,Zipline,https://www.linkedin.com/company/zipline-international/,flyzipline.com,501-1000,San Francisco,USA,"Engineering, Ops",Medical delivery drones; global scale
26,Drone & UAV - Global,Shield AI,https://www.linkedin.com/company/shield-ai/,shield.ai,501-1000,San Diego,USA,"Engineering, GTM",Military autonomous systems
27,Drone & UAV - Global,Percepto,https://www.linkedin.com/company/percepto/,percepto.com,201-500,Tel Aviv,Israel,"Engineering, GTM",Autonomous inspection drones; enterprise B2B
28,Drone & UAV - Global,Joby Aviation,https://www.linkedin.com/company/joby-aviation/,jobyaviation.com,1001-5000,Santa Cruz,USA,Engineering,Electric air taxi; deep tech
29,Drone & UAV - Global,Volocopter,https://www.linkedin.com/company/volocopter/,volocopter.com,501-1000,Bruchsal,Germany,Engineering,Urban air mobility
30,Drone & UAV - Global,Wisk Aero,https://www.linkedin.com/company/wisk-aero/,wisk.aero,201-500,Mountain View,USA,Engineering,Autonomous air taxi
31,Drone & UAV - Global,Dronamics,https://www.linkedin.com/company/dronamics/,dronamics.com,51-200,London,UK,Engineering,Cargo drone logistics
32,Drone & UAV - Global,Iris Automation,https://www.linkedin.com/company/iris-automation/,irisonboard.com,51-200,Reno,USA,Engineering,Drone detect-and-avoid systems
33,Drone & UAV - Global,Dedrone,https://www.linkedin.com/company/dedrone/,dedrone.com,201-500,Washington DC,USA,"Engineering, GTM",Counter-UAS platform; enterprise B2B
34,Drone & UAV - Global,Fortem Technologies,https://www.linkedin.com/company/fortem-technologies/,fortemtech.com,51-200,Pleasant Grove,USA,Engineering,Drone defense systems
35,Drone & UAV - Global,AeroVironment,https://www.linkedin.com/company/aerovironment-inc/,avinc.com,1001-5000,Arlington,USA,Engineering,Small military UAS; public company
36,Drone & UAV - Global,Kratos Defense,https://www.linkedin.com/company/kratos-defense-security-solutions/,kratosdefense.com,1001-5000,San Diego,USA,Engineering,Unmanned systems; defence
37,Drone & UAV - Global,Beta Technologies,https://www.linkedin.com/company/beta-technologies-inc/,beta.team,201-500,Burlington,USA,Engineering,Electric VTOL aircraft
38,Drone & UAV - Global,American Robotics,https://www.linkedin.com/company/american-robotics/,american-robotics.com,51-200,Northborough,USA,Engineering,Automated drone-in-a-box; similar to FlytBase
39,Drone & UAV - Global,Auterion,https://www.linkedin.com/company/auterion/,auterion.com,51-200,Zurich,Switzerland,"Engineering, Product",Enterprise drone OS/software; VERY similar to FlytBase
40,Drone & UAV - Global,DroneDeploy,https://www.linkedin.com/company/dronedeploy/,dronedeploy.com,201-500,San Francisco,USA,"Engineering, GTM, Product",Drone mapping software platform; VERY similar to FlytBase
41,Drone & UAV - Global,Pix4D,https://www.linkedin.com/company/pix4d/,pix4d.com,201-500,Lausanne,Switzerland,"Engineering, Product",Drone photogrammetry software; similar to FlytBase
42,Drone & UAV - Global,AirMap,https://www.linkedin.com/company/airmap/,airmap.com,51-200,Santa Monica,USA,"Engineering, GTM",Drone traffic management platform; very similar
43,Drone & UAV - Global,Unifly,https://www.linkedin.com/company/unifly/,unifly.aero,51-200,Antwerp,Belgium,"Engineering, GTM",UTM drone software platform; similar to FlytBase
44,Drone & UAV - Global,ANRA Technologies,https://www.linkedin.com/company/anra-technologies/,anratechnologies.com,51-200,"Chantilly, VA",USA,"Engineering, GTM",Drone ops/UTM platform; very similar to FlytBase
45,Drone & UAV - Global,Altitude Angel,https://www.linkedin.com/company/altitude-angel/,altitudeangel.com,51-200,Reading,UK,Engineering,UTM/UAS traffic management; similar
46,Drone & UAV - Global,PrecisionHawk,https://www.linkedin.com/company/precisionhawk/,precisionhawk.com,201-500,Raleigh,USA,Engineering,Drone data analytics
47,Robotics & Automation - India,GreyOrange,https://www.linkedin.com/company/greyorange/,greyorange.com,501-1000,Gurugram,India,"Engineering, Product, GTM",Warehouse robotics unicorn; India HQ global sales
48,Robotics & Automation - India,Hi-Tech Robotic Systemz,https://www.linkedin.com/company/hi-tech-robotic-systemz/,hitechroboticsystemz.com,201-500,Gurugram,India,Engineering,Autonomous vehicles; India HQ
49,Robotics & Automation - India,Addverb Technologies,https://www.linkedin.com/company/addverb-technologies/,addverb.com,501-1000,Noida,India,"Engineering, GTM",Warehouse automation robotics
50,Robotics & Automation - India,Sastra Robotics,https://www.linkedin.com/company/sastra-robotics/,sastrarobotics.com,51-200,Kochi,India,Engineering,Robotic testing solutions
51,Robotics & Automation - India,Planys Technologies,https://www.linkedin.com/company/planys-technologies/,planystech.com,51-200,Chennai,India,Engineering,Underwater ROV drones; similar tech
52,Robotics & Automation - India,Asimov Robotics,https://www.linkedin.com/company/asimov-robotics/,asimovrobotics.com,51-200,Kochi,India,Engineering,Humanoid robots; deep tech India
53,Space Tech - India,Pixxel,https://www.linkedin.com/company/pixxelspace/,pixxel.space,51-200,Bengaluru,India,Engineering,Earth observation satellites; India deep tech
54,Space Tech - India,Agnikul Cosmos,https://www.linkedin.com/company/agnikul-cosmos/,agnikul.in,201-500,Chennai,India,Engineering,Small launch vehicles; deep tech India
55,Space Tech - India,Skyroot Aerospace,https://www.linkedin.com/company/skyroot-aerospace/,skyroot.com,201-500,Hyderabad,India,Engineering,Space launch startup; India HQ
56,Space Tech - India,Bellatrix Aerospace,https://www.linkedin.com/company/bellatrix-aerospace/,bellatrixaerospace.com,51-200,Bengaluru,India,Engineering,Space propulsion; India deep tech
57,Space Tech - India,Dhruva Space,https://www.linkedin.com/company/dhruva-space/,dhruvaspace.com,51-200,Hyderabad,India,Engineering,Satellite services; India HQ
58,Space Tech - India,GalaxEye,https://www.linkedin.com/company/galaxeye-space/,galaxeye.space,51-200,Chennai,India,Engineering,SAR imaging satellites; India deep tech
59,Space Tech - India,Digantara,https://www.linkedin.com/company/digantara/,digantara.com,51-200,Bengaluru,India,Engineering,Space debris monitoring; India HQ
60,B2B SaaS - India,Chargebee,https://www.linkedin.com/company/chargebee/,chargebee.com,501-1000,Chennai,India,"Engineering, Product, GTM, Ops",B2B SaaS unicorn; India HQ global sales
61,B2B SaaS - India,Freshworks,https://www.linkedin.com/company/freshworks-inc/,freshworks.com,5001-10000,Chennai,India,"Engineering, Product, GTM, Ops",Major B2B SaaS; India HQ global clients
62,B2B SaaS - India,Postman,https://www.linkedin.com/company/postman-platform/,postman.com,501-1000,Bengaluru,India,"Engineering, Product, GTM",Dev tools SaaS; India HQ global product
63,B2B SaaS - India,BrowserStack,https://www.linkedin.com/company/browserstack/,browserstack.com,1001-5000,Mumbai,India,"Engineering, Product, GTM",Testing SaaS; India HQ global clients
64,B2B SaaS - India,Druva,https://www.linkedin.com/company/druva-inc/,druva.com,1001-5000,Bengaluru,India,"Engineering, GTM",Cloud data SaaS; India HQ global sales
65,B2B SaaS - India,Icertis,https://www.linkedin.com/company/icertis/,icertis.com,1001-5000,Pune,India,"Engineering, GTM, Ops",Contract management SaaS; India HQ global
66,B2B SaaS - India,Darwinbox,https://www.linkedin.com/company/darwinbox/,darwinbox.com,501-1000,Hyderabad,India,"Engineering, Product, GTM",HR SaaS unicorn; India HQ global
67,B2B SaaS - India,Uniphore,https://www.linkedin.com/company/uniphore-software-systems/,uniphore.com,501-1000,Chennai,India,"Engineering, GTM",Conversational AI SaaS; India HQ global
68,B2B SaaS - India,Whatfix,https://www.linkedin.com/company/whatfix/,whatfix.com,501-1000,Bengaluru,India,"Engineering, Product, GTM",Digital adoption SaaS; India HQ global sales
69,B2B SaaS - India,Mindtickle,https://www.linkedin.com/company/mindtickle/,mindtickle.com,501-1000,Pune,India,"Engineering, GTM",Sales enablement SaaS; India HQ global
70,B2B SaaS - India,Gupshup,https://www.linkedin.com/company/gupshup-inc/,gupshup.io,501-1000,Bengaluru,India,"Engineering, GTM",Messaging SaaS; India HQ global
71,B2B SaaS - India,Exotel,https://www.linkedin.com/company/exotel/,exotel.com,201-500,Bengaluru,India,"Engineering, GTM",Cloud telephony; India HQ global clients
72,B2B SaaS - India,Capillary Technologies,https://www.linkedin.com/company/capillary-technologies/,capillarytech.com,501-1000,Bengaluru,India,"Engineering, GTM",Customer engagement SaaS; India HQ global
73,B2B SaaS - India,Innovaccer,https://www.linkedin.com/company/innovaccer/,innovaccer.com,501-1000,Noida,India,"Engineering, Product, GTM",Health data SaaS; India HQ global
74,B2B SaaS - India,LeadSquared,https://www.linkedin.com/company/leadsquared/,leadsquared.com,501-1000,Bengaluru,India,"Engineering, GTM, Ops",Sales CRM SaaS; India HQ
75,B2B SaaS - India,Yellow.ai,https://www.linkedin.com/company/yellow-ai/,yellow.ai,501-1000,Bengaluru,India,"Engineering, GTM",Conversational AI SaaS; India HQ global
76,B2B SaaS - India,Kore.ai,https://www.linkedin.com/company/kore-ai/,kore.ai,501-1000,Hyderabad,India,"Engineering, GTM",Enterprise AI platform; India HQ global
77,B2B SaaS - India,MoEngage,https://www.linkedin.com/company/moengage/,moengage.com,501-1000,Bengaluru,India,"Engineering, Product, GTM",Customer engagement SaaS; India HQ global
78,B2B SaaS - India,WebEngage,https://www.linkedin.com/company/webengage/,webengage.com,201-500,Mumbai,India,"Engineering, GTM",Marketing automation SaaS; India HQ
79,B2B SaaS - India,CleverTap,https://www.linkedin.com/company/clevertap/,clevertap.com,501-1000,Mumbai,India,"Engineering, GTM",Mobile engagement SaaS; India HQ global
80,B2B SaaS - India,Netcore Cloud,https://www.linkedin.com/company/netcore-solutions/,netcorecloud.com,501-1000,Mumbai,India,"Engineering, GTM",Marketing SaaS; India HQ global
81,B2B SaaS - India,Hasura,https://www.linkedin.com/company/hasura/,hasura.io,201-500,Bengaluru,India,"Engineering, Product, GTM",GraphQL platform; India HQ global devs
82,B2B SaaS - India,Factors.ai,https://www.linkedin.com/company/factors-ai/,factors.ai,51-200,Bengaluru,India,"Engineering, GTM",B2B revenue analytics; India HQ
83,B2B SaaS - India,Wingify,https://www.linkedin.com/company/wingify/,wingify.com,201-500,New Delhi,India,"Engineering, GTM",A/B testing SaaS; India HQ global clients
84,B2B SaaS - India,Gainsight India,https://www.linkedin.com/company/gainsight/,gainsight.com,1001-5000,Hyderabad,India,"Engineering, GTM",Customer success SaaS; large India office
85,B2B SaaS - India,Sprinklr,https://www.linkedin.com/company/sprinklr/,sprinklr.com,5001-10000,Bengaluru,India,"Engineering, GTM",Unified CX platform; large India office
86,B2B SaaS - India,Zoho,https://www.linkedin.com/company/zoho-corporation/,zoho.com,10001+,Chennai,India,"Engineering, Product, GTM",Business SaaS suite; India HQ global
87,B2B SaaS - India,Haptik,https://www.linkedin.com/company/haptik/,haptik.ai,201-500,Mumbai,India,"Engineering, GTM",Conversational AI; India HQ
88,B2B SaaS - India,Locus,https://www.linkedin.com/company/locus-sh/,locus.sh,201-500,Bengaluru,India,"Engineering, GTM",Supply chain SaaS; India HQ global
89,B2B SaaS - India,Zetwerk,https://www.linkedin.com/company/zetwerk/,zetwerk.com,1001-5000,Bengaluru,India,"Engineering, GTM, Ops",Manufacturing marketplace; India HQ global
90,B2B SaaS - India,Juspay,https://www.linkedin.com/company/juspay-technologies/,juspay.in,501-1000,Bengaluru,India,Engineering,Payment infrastructure SaaS; India HQ global
91,B2B SaaS - India,M2P Fintech,https://www.linkedin.com/company/m2p-fintech/,m2p.in,501-1000,Chennai,India,"Engineering, GTM",API banking infrastructure; India HQ global
92,B2B SaaS - India,Cashfree Payments,https://www.linkedin.com/company/cashfree/,cashfree.com,201-500,Bengaluru,India,"Engineering, GTM",Payment gateway; India HQ global
93,B2B SaaS - India,Salesken,https://www.linkedin.com/company/salesken-ai/,salesken.ai,201-500,Bengaluru,India,GTM,Sales AI; India HQ global B2B
94,B2B SaaS - India,Vymo,https://www.linkedin.com/company/vymo/,getvymo.com,201-500,Bengaluru,India,GTM,Field sales SaaS; India HQ global
95,B2B SaaS - India,Sarvam AI,https://www.linkedin.com/company/sarvam-ai/,sarvam.ai,51-200,Bengaluru,India,"Engineering, Product",Indian language AI; India deep tech
96,B2B SaaS - India,E2E Networks,https://www.linkedin.com/company/e2e-networks/,e2enetworks.com,201-500,New Delhi,India,"Engineering, GTM",GPU cloud; India HQ
97,B2B SaaS - India,Krutrim,https://www.linkedin.com/company/krutrim/,olakrutrim.com,51-200,Bengaluru,India,"Engineering, Product",Indian AI LLM startup
98,B2B SaaS - India,Smallcase Technologies,https://www.linkedin.com/company/smallcase-technologies/,smallcase.com,201-500,Bengaluru,India,"Engineering, Product",Investment platform; India HQ
99,B2B SaaS - India,Open Financial Technologies,https://www.linkedin.com/company/open-financial-technologies/,open.money,201-500,Bengaluru,India,"Engineering, GTM",Neobank SaaS; India HQ
100,B2B SaaS - India,Razorpay,https://www.linkedin.com/company/razorpay/,razorpay.com,1001-5000,Bengaluru,India,"Engineering, Product, GTM, Ops",Payments unicorn; India HQ global
101,Deep Tech & AI - India,Fractal Analytics,https://www.linkedin.com/company/fractal-analytics/,fractal.ai,5001-10000,Mumbai,India,"Engineering, GTM",Decision science AI; India HQ global clients
102,Deep Tech & AI - India,Quantiphi,https://www.linkedin.com/company/quantiphi/,quantiphi.com,1001-5000,Mumbai,India,Engineering,Applied AI/ML; India HQ global
103,Deep Tech & AI - India,Sigmoid,https://www.linkedin.com/company/sigmoid/,sigmoid.com,501-1000,Bengaluru,India,Engineering,Data engineering platform; India HQ
104,Deep Tech & AI - India,Mu Sigma,https://www.linkedin.com/company/mu-sigma-inc/,mu-sigma.com,5001-10000,Bengaluru,India,"Engineering, Ops",Decision sciences; India HQ global
105,Deep Tech & AI - India,Tiger Analytics,https://www.linkedin.com/company/tiger-analytics/,tigeranalytics.com,1001-5000,Chennai,India,Engineering,Advanced analytics; India HQ global
106,Deep Tech & AI - India,Wadhwani AI,https://www.linkedin.com/company/wadhwani-ai/,wadhwaniai.org,201-500,Mumbai,India,Engineering,Applied AI for social good; India HQ
107,Deep Tech & AI - India,Cropin,https://www.linkedin.com/company/cropin-technology-solutions/,cropin.com,201-500,Bengaluru,India,"Engineering, GTM",AgriTech AI/IoT; India HQ global
108,Deep Tech & AI - India,Arya.ai,https://www.linkedin.com/company/arya-ai/,arya.ai,51-200,Mumbai,India,"Engineering, GTM",Financial AI; India HQ
109,Deep Tech & AI - India,SigTuple,https://www.linkedin.com/company/sigtuple/,sigtuple.com,51-200,Bengaluru,India,Engineering,Medical AI diagnostics; India deep tech
110,Deep Tech & AI - India,Niramai,https://www.linkedin.com/company/niramai-health-analytix/,niramai.com,51-200,Bengaluru,India,Engineering,Thermal AI for cancer detection; deep tech
111,Deep Tech & AI - India,Tricog Health,https://www.linkedin.com/company/tricog-health/,tricog.com,51-200,Bengaluru,India,Engineering,Cardiac AI; India deep tech
112,Deep Tech & AI - India,Stellapps,https://www.linkedin.com/company/stellapps/,stellapps.com,51-200,Bengaluru,India,Engineering,Dairy tech IoT/AI; India HQ
113,Deep Tech & AI - India,Artivatic.ai,https://www.linkedin.com/company/artivatic/,artivatic.ai,51-200,Bengaluru,India,"Engineering, GTM",Insurance AI; India HQ
114,Deep Tech & AI - India,Videonetics,https://www.linkedin.com/company/videonetics/,videonetics.com,201-500,Kolkata,India,"Engineering, GTM",Intelligent video analytics; India HQ global
115,Deep Tech & AI - India,Staqu Technologies,https://www.linkedin.com/company/staqu-technologies/,staqu.com,51-200,Gurugram,India,Engineering,AI surveillance; India HQ
116,Deep Tech & AI - India,Uncanny Vision,https://www.linkedin.com/company/uncanny-vision/,uncannyvision.com,51-200,Bengaluru,India,Engineering,Edge AI computer vision; India HQ
117,Deep Tech & AI - India,MapmyIndia,https://www.linkedin.com/company/mapmyindia/,mapmyindia.com,501-1000,New Delhi,India,"Engineering, GTM",Maps/GIS platform; India HQ global
118,Aerospace & Defence - Global,Boeing India,https://www.linkedin.com/company/the-boeing-company/,boeing.com,10001+,Bengaluru,India office,Engineering,Aerospace giant; large India R&D centre
119,Aerospace & Defence - Global,Airbus India,https://www.linkedin.com/company/airbus/,airbus.com,10001+,Bengaluru,India office,Engineering,Aerospace; large India engineering office
120,Aerospace & Defence - Global,Safran,https://www.linkedin.com/company/safran/,safran-group.com,10001+,Bengaluru,India office,Engineering,Aircraft engines; India R&D centre
121,Aerospace & Defence - Global,BAE Systems,https://www.linkedin.com/company/bae-systems/,baesystems.com,10001+,Bengaluru,India office,Engineering,Defence; India office
122,Aerospace & Defence - Global,Lockheed Martin,https://www.linkedin.com/company/lockheed-martin/,lockheedmartin.com,10001+,Bethesda,USA,Engineering,Aerospace/defence; global talent pool
123,Aerospace & Defence - Global,Northrop Grumman,https://www.linkedin.com/company/northrop-grumman-corporation/,northropgrumman.com,10001+,Falls Church,USA,Engineering,Defence/autonomous systems
124,Aerospace & Defence - Global,Raytheon (RTX),https://www.linkedin.com/company/rtx/,rtx.com,10001+,Arlington,USA,Engineering,Aerospace/defence tech
125,Aerospace & Defence - Global,General Atomics,https://www.linkedin.com/company/general-atomics/,ga.com,5001-10000,San Diego,USA,Engineering,Predator drone manufacturer; key talent
126,Aerospace & Defence - Global,AeroVironment (dup),https://www.linkedin.com/company/aerovironment-inc/,avinc.com,1001-5000,Arlington,USA,Engineering,Small military UAS; public company
127,Aerospace & Defence - Global,Palantir,https://www.linkedin.com/company/palantir-technologies/,palantir.com,1001-5000,Bengaluru,India office,"Engineering, GTM",Data/AI for defence and govt; India office
128,Aerospace & Defence - Global,Anduril Industries,https://www.linkedin.com/company/anduril-industries/,anduril.com,1001-5000,Costa Mesa,USA,Engineering,Autonomous defence tech; key talent source
129,Aerospace & Defence - Global,Mobileye,https://www.linkedin.com/company/mobileye/,mobileye.com,1001-5000,Jerusalem,Israel,Engineering,Autonomous driving/ADAS; global talent
130,Autonomous Vehicles - Global,Waymo,https://www.linkedin.com/company/waymo/,waymo.com,1001-5000,Mountain View,USA,"Engineering, Product",Self-driving; top AI/autonomy talent source
131,Autonomous Vehicles - Global,Aurora Innovation,https://www.linkedin.com/company/aurora-innovation/,aurora.tech,1001-5000,Pittsburgh,USA,Engineering,Self-driving trucks; autonomy talent
132,Autonomous Vehicles - Global,Nuro,https://www.linkedin.com/company/nuro.ai/,nuro.ai,501-1000,Mountain View,USA,Engineering,Autonomous delivery robots
133,Autonomous Vehicles - Global,Luminar Technologies,https://www.linkedin.com/company/luminar-technologies/,luminartech.com,501-1000,Orlando,USA,Engineering,LiDAR sensors for autonomous systems
134,Autonomous Vehicles - Global,Ouster,https://www.linkedin.com/company/ouster-lidar/,ouster.com,201-500,San Francisco,USA,Engineering,LiDAR sensors; similar tech stack
135,Autonomous Vehicles - Global,Hesai Technology,https://www.linkedin.com/company/hesai-tech/,hesaitech.com,501-1000,Shanghai,China,Engineering,LiDAR for autonomous systems
136,Global Tech - India Office,Microsoft India,https://www.linkedin.com/company/microsoft/,microsoft.com,10001+,Hyderabad/Bengaluru,India office,"Engineering, Product",Azure/AI; large India engineering team
137,Global Tech - India Office,Google India,https://www.linkedin.com/company/google/,google.com,10001+,Hyderabad/Bengaluru,India office,"Engineering, Product",Search/Cloud/AI; large India team
138,Global Tech - India Office,Amazon / AWS India,https://www.linkedin.com/company/amazon/,amazon.com,10001+,Hyderabad/Bengaluru,India office,"Engineering, Product, GTM",Cloud; massive India engineering centre
139,Global Tech - India Office,Meta India,https://www.linkedin.com/company/meta/,meta.com,10001+,Hyderabad/Bengaluru,India office,"Engineering, Product",Social/AI; India engineering team
140,Global Tech - India Office,Uber India,https://www.linkedin.com/company/uber-com/,uber.com,10001+,Bengaluru,India office,"Engineering, Product",Mobility tech; large India engineering
141,Global Tech - India Office,Stripe India,https://www.linkedin.com/company/stripe/,stripe.com,5001-10000,Bengaluru,India office,"Engineering, Product",Payments infra; India engineering hub
142,Global Tech - India Office,Atlassian India,https://www.linkedin.com/company/atlassian/,atlassian.com,10001+,Bengaluru,India office,"Engineering, Product, GTM",Dev tools SaaS; large India team
143,Global Tech - India Office,Twilio India,https://www.linkedin.com/company/twilio-inc-/,twilio.com,5001-10000,Bengaluru,India office,"Engineering, GTM",Communications SaaS; India office
144,Global Tech - India Office,Databricks India,https://www.linkedin.com/company/databricks/,databricks.com,5001-10000,Bengaluru,India office,"Engineering, GTM",Data/AI platform; India engineering hub
145,Global Tech - India Office,Snowflake India,https://www.linkedin.com/company/snowflake-computing/,snowflake.com,5001-10000,Bengaluru,India office,"Engineering, GTM",Data cloud; India office
146,Global Tech - India Office,Salesforce India,https://www.linkedin.com/company/salesforce/,salesforce.com,10001+,Hyderabad,India office,"Engineering, GTM",CRM; large India office
147,Global Tech - India Office,ServiceNow India,https://www.linkedin.com/company/servicenow/,servicenow.com,10001+,Hyderabad,India office,"Engineering, GTM",IT SaaS; large India engineering
148,Global Tech - India Office,Workday India,https://www.linkedin.com/company/workday/,workday.com,10001+,Bengaluru,India office,"Engineering, GTM",HR SaaS; India engineering hub
149,Global Tech - India Office,HubSpot India,https://www.linkedin.com/company/hubspot/,hubspot.com,5001-10000,Bengaluru,India office,"Engineering, GTM",CRM/Marketing SaaS; India office
150,Global Tech - India Office,SAP India,https://www.linkedin.com/company/sap/,sap.com,10001+,Bengaluru,India office,"Engineering, GTM",ERP/SaaS; large India engineering
151,Global Tech - India Office,Oracle India,https://www.linkedin.com/company/oracle/,oracle.com,10001+,Bengaluru,India office,"Engineering, GTM",Database/cloud; large India team
152,Global Tech - India Office,Confluent India,https://www.linkedin.com/company/confluent-inc/,confluent.io,1001-5000,Pune,India office,"Engineering, GTM",Data streaming; India engineering hub
153,Global Tech - India Office,Appier,https://www.linkedin.com/company/appier/,appier.com,501-1000,Bengaluru,India office,"Engineering, GTM",AI marketing; India office
154,Industrial IoT & Embedded,Tata Elxsi,https://www.linkedin.com/company/tata-elxsi/,tataelxsi.com,5001-10000,Bengaluru,India,"Engineering, Product",Embedded/IoT design; India HQ global
155,Industrial IoT & Embedded,Sasken Technologies,https://www.linkedin.com/company/sasken/,sasken.com,1001-5000,Bengaluru,India,Engineering,IoT/embedded software; India HQ
156,Industrial IoT & Embedded,Embitel Technologies,https://www.linkedin.com/company/embitel-technologies/,embitel.com,501-1000,Bengaluru,India,Engineering,Embedded/IoT systems; India HQ
157,Industrial IoT & Embedded,KPIT Technologies,https://www.linkedin.com/company/kpit-technologies/,kpit.com,10001+,Pune,India,Engineering,Automotive software; India HQ global
158,Industrial IoT & Embedded,Siemens India,https://www.linkedin.com/company/siemens/,siemens.co.in,10001+,Mumbai,India office,Engineering,Industrial automation; large India centre
159,Industrial IoT & Embedded,Honeywell India,https://www.linkedin.com/company/honeywell/,honeywell.com,10001+,Chennai,India office,"Engineering, GTM",Industrial tech; large India team
160,Industrial IoT & Embedded,ABB India,https://www.linkedin.com/company/abb/,abb.in,10001+,Bengaluru,India office,Engineering,Robotics and automation; India centre
161,Industrial IoT & Embedded,Bosch India,https://www.linkedin.com/company/bosch-india/,bosch.in,10001+,Bengaluru,India office,Engineering,IoT solutions; large India R&D
162,Industrial IoT & Embedded,Rockwell Automation,https://www.linkedin.com/company/rockwell-automation/,rockwellautomation.com,10001+,Pune,India office,Engineering,Factory automation; India office
163,Consulting & Strategy,McKinsey India,https://www.linkedin.com/company/mckinsey-&-company/,mckinsey.com,10001+,Mumbai/Delhi/Bengaluru,India office,"Ops, GTM",Top strategy consulting; ops talent
164,Consulting & Strategy,BCG India,https://www.linkedin.com/company/boston-consulting-group/,bcg.com,10001+,Mumbai/Delhi,India office,"Ops, GTM",Strategy consulting; ops/GTM talent
165,Consulting & Strategy,Bain India,https://www.linkedin.com/company/bain-and-company/,bain.com,10001+,Mumbai/Delhi,India office,"Ops, GTM",Strategy consulting; ops talent
166,Consulting & Strategy,Kearney India,https://www.linkedin.com/company/a.t.-kearney/,kearney.com,5001-10000,Mumbai/Delhi,India office,Ops,Operations consulting; ops talent
167,Consulting & Strategy,Deloitte India,https://www.linkedin.com/company/deloitte/,deloitte.com,10001+,Mumbai,India office,"Ops, GTM",Advisory; ops and GTM talent
168,Consulting & Strategy,EY India,https://www.linkedin.com/company/ernstandyoung/,ey.com,10001+,Mumbai,India office,"Ops, GTM",Advisory; ops talent
169,Consulting & Strategy,Accenture India,https://www.linkedin.com/company/accenture/,accenture.com,10001+,Mumbai/Bengaluru,India office,"Engineering, Ops, GTM",Tech consulting; broad talent pool
170,Consulting & Strategy,ThoughtWorks India,https://www.linkedin.com/company/thoughtworks/,thoughtworks.com,10001+,Bengaluru,India,Engineering,Tech consultancy; strong engineering
171,Indian Unicorns & High-Growth,Swiggy,https://www.linkedin.com/company/swiggy-in/,swiggy.com,5001-10000,Bengaluru,India,"Engineering, Product, Ops",Food tech unicorn; strong engineering
172,Indian Unicorns & High-Growth,Zomato,https://www.linkedin.com/company/zomato/,zomato.com,5001-10000,Gurugram,India,"Engineering, Product, Ops",Food delivery; large tech team
173,Indian Unicorns & High-Growth,CRED,https://www.linkedin.com/company/cred-club/,cred.club,1001-5000,Bengaluru,India,"Engineering, Product, GTM",Fintech unicorn; top product talent
174,Indian Unicorns & High-Growth,PhonePe,https://www.linkedin.com/company/phonepe-internet/,phonepe.com,1001-5000,Bengaluru,India,"Engineering, Product",Payments unicorn; India HQ
175,Indian Unicorns & High-Growth,Meesho,https://www.linkedin.com/company/meesho/,meesho.com,1001-5000,Bengaluru,India,"Engineering, Product, GTM",Social commerce unicorn
176,Indian Unicorns & High-Growth,Groww,https://www.linkedin.com/company/groww/,groww.in,1001-5000,Bengaluru,India,"Engineering, Product",Investment platform; fast growth
177,Indian Unicorns & High-Growth,Zepto,https://www.linkedin.com/company/zepto-app/,zeptonow.com,1001-5000,Mumbai,India,"Engineering, Product, Ops",Quick commerce; fast scaling
178,Indian Unicorns & High-Growth,Urban Company,https://www.linkedin.com/company/urban-company/,urbancompany.com,1001-5000,Gurugram,India,"Engineering, Product, Ops",Services marketplace; India HQ global
179,Indian Unicorns & High-Growth,InMobi,https://www.linkedin.com/company/inmobi/,inmobi.com,1001-5000,Bengaluru,India,"Engineering, Product, GTM",Mobile ad tech; India HQ global
180,Indian Unicorns & High-Growth,Delhivery,https://www.linkedin.com/company/delhivery/,delhivery.com,5001-10000,Gurugram,India,"Engineering, Product, Ops",Logistics tech; India HQ
181,Indian Unicorns & High-Growth,Ninjacart,https://www.linkedin.com/company/ninjacart/,ninjacart.com,1001-5000,Bengaluru,India,"Engineering, Ops, GTM",AgriTech B2B; India HQ
182,Indian Unicorns & High-Growth,Udaan,https://www.linkedin.com/company/udaan-com/,udaan.com,1001-5000,Bengaluru,India,"Engineering, GTM, Ops",B2B commerce; India HQ
183,Indian Unicorns & High-Growth,upGrad,https://www.linkedin.com/company/upgrad-edu/,upgrad.com,1001-5000,Mumbai,India,"Engineering, Product, GTM",EdTech unicorn; India HQ global
184,Indian Unicorns & High-Growth,Flipkart,https://www.linkedin.com/company/flipkart/,flipkart.com,10001+,Bengaluru,India,"Engineering, Product, GTM, Ops",E-commerce; massive India talent pool
185,Indian Unicorns & High-Growth,Pine Labs,https://www.linkedin.com/company/pine-labs/,pinelabs.com,1001-5000,Noida,India,"Engineering, GTM",POS fintech; India HQ global
186,Indian Unicorns & High-Growth,PolicyBazaar,https://www.linkedin.com/company/policybazaar/,policybazaar.com,1001-5000,Gurugram,India,"Engineering, GTM",Insurance marketplace; India HQ`;

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields containing commas
// ---------------------------------------------------------------------------
function parseCSV(raw: string): string[][] {
  return raw.split("\n").map((line) => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seed() {
  const rows = parseCSV(RAW);
  // Row 0 is the header
  const dataRows = rows.slice(1).filter((r) => r.length >= 9 && r[3]);

  const records = dataRows.map((r) => ({
    name:         r[2],
    linkedin_url: r[3],
    website:      r[4] || null,
    industry:     r[1] || null,   // category column
    size_range:   r[5] || null,
    hq_city:      r[6] || null,
    hq_country:   r[7] || null,
    why_similar:  r[9] || null,
    is_active:    true,
  }));

  console.log(`Upserting ${records.length} companies…`);

  // Batch in chunks of 50 to stay well within Supabase limits
  const CHUNK = 50;
  let upserted = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("target_companies")
      .upsert(chunk, { onConflict: "linkedin_url" });
    if (error) {
      console.error(`Chunk ${i / CHUNK + 1} failed: ${error.message}`);
      process.exit(1);
    }
    upserted += chunk.length;
    console.log(`  ${upserted}/${records.length} upserted`);
  }

  console.log(`\nDone — ${upserted} rows inserted/updated.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
