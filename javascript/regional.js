
//wait for the rest of the document to load
$( document ).ready(function() {
    $.cookie.raw = true;
   renderPage();
 });

//Main logic based on cookies
function renderPage(){
    console.log("renderPage called");
   var current_region = $.cookie('current_region');
   var defaulLocationList = $.cookie('defaultLocationList');
   if (defaulLocationList !== undefined) {
    $.cookie('defaulLocationList', locations, {expire: 365});
   }

   if (current_region !== undefined) {
       $( "#appstatus" ).text(current_region);
       $( "#appstatus" ).off("click");
       $( "#appstatus" ).click(clearDefaultLocation);
   } else {
       $( "#appstatus" ).text("Please select your default location");
       $( "#appstatus" ).off("click");
       $( "#appstatus" ).click(setDefaultLocation);
   };
   $( "#appstatus" ).show();
};

function clearDefaultLocation(){
    console.log("clearDefaultLocation called");
    $( "#appstatus" ).fadeOut(400, function(){
        $.removeCookie('current_region');
        renderPage();
        });
};

function setDefaultLocation(){
    console.log("setDefaultLocation called");
    $( "#appstatus" ).fadeOut(400, function(){
        $.cookie('current_region', 'Munchen', {expire: 365});
        renderPage();
        });
};

var locations = {[
    {
        "Display": "Den Haag",
        "ShortCode": "DHG"
    },
    {
        "Display": "Munchen",
        "ShortCode": "MUC"
    },
    {
        "Display": "Voorburg",
        "ShortCode": "VBG"
    }
]};
