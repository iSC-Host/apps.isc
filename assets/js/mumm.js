/* ================================= */
/* :::::::::: 1. Loading ::::::::::: */
/* ================================= */

$(window).load(function() {
	"use strict";
	
	$('.globload').fadeOut("slow")
	
	setTimeout(function() {
		
		$("header").addClass("fadeIn").removeClass("opacity-0");
		
	}, 200);
	
	setTimeout(function() {
		
		$("#text-construction-2").addClass("fadeIn").removeClass("opacity-0");
		
	}, 400);
	
	setTimeout(function() {
		
		$("#days-animation").addClass("fadeIn").removeClass("opacity-0");
		
	}, 600);
	
	setTimeout(function() {
		
		$("#hours-animation").addClass("fadeIn").removeClass("opacity-0");
		
	}, 800);
	
	setTimeout(function() {
		
		$("#minutes-animation").addClass("fadeIn").removeClass("opacity-0");
		$(".control-video").addClass("slideInDown").removeClass("opacity-0");
		
	}, 1000);
	
	setTimeout(function() {
		
		$("#seconds-animation").addClass("fadeIn").removeClass("opacity-0");
		
	}, 1200);
	
	setTimeout(function() {
		
		$("#subscribe").addClass("fadeIn").removeClass("opacity-0");
		
	}, 1200);
		
});

/* ================================= */
/* ::::::::: 2. Countdown :::::::::: */
/* ================================= */

$('#countdown_dashboard').countDown({
		targetDate: {
			'day': 		30,
			'month': 	12,
			'year': 	2015,
			'hour': 	11,
			'min': 		13,
			'sec': 		0
		},
		omitWeeks: true
});
		
/* ================================= */
/* :::::::::: 3. Carousel :::::::::: */
/* ================================= */

$('.carousel').carousel({
	  interval: 5000
})

/* ================================= */
/* :::::::: 4. Multiscroll ::::::::: */
/* ================================= */

$(document).ready(function() {
	"use strict";
            $('#myContainer').multiscroll({
            	sectionsColor: ['#2B2D35', '#F1E7C0', '#7BAABE'],
            	anchors: ['first', 'second', 'third'],
            	menu: '#menu',
            	navigation: true,
            	navigationTooltips: ['Welcome', 'About', 'Contact'],
            	loopBottom: true,
            	loopTop: true
            });
        });