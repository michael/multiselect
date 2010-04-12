/**
 * Multiselect demo page initialisation script
 *
 * @author Yanick Rochon
 */

$(function() {

	var DEBUG = false; // true for displaying debug information

	$('#debug').dialog({
		autoOpen: DEBUG,   
		closeOnEscape: true,
		draggable: true,
		resizable: true,
		position: [10, 140],
		width: 300,
		height: 300,
		title: 'Debug',
		buttons: {
			'Clear': function() {
				$('#debug').html('');
			}
		}
	});
	if (DEBUG) {
		// bind error messages
		$('#countries, #languages').bind('multiselectmessages', function(event, ui) {
			$('#debug').append('<div>' + ui.message + '</div>');
		})
		.bind('multiselectselected', function(event, ui) {
			$('#debug').append('<div>The option ' + $(ui.option).text() + " was selected</div>");
		})
		.bind('multiselectdeselected', function(event, ui) {
			$('#debug').append('<div>The option ' + $(ui.option).text() + " was deselected</div>");
		})
		;
	};

	$.ajaxSetup({ cache: false });  // prevent server caching the requests throughout the demo page
	$.get('version.txt', function(data) { $('#header #version').text('version ' + data); });

	$('#license-info-MIT').dialog({
		autoOpen:false,
		title:"License information - MIT",
		width:580,
		height:380,
		resizable:false,
		modal:true
	});
	$('#license-MIT').click(function() { $('#license-info-MIT').dialog('open'); return false; });
	$('#license-info-GPL').dialog({
		autoOpen:false,
		title:"License information - GPL",
		width:620,
		height:380,
		resizable:false,
		modal:true
	});
	$('#license-GPL').click(function() { $('#license-info-GPL').dialog('open'); return false; });

	$('#tabs, #optionTabs').tabs();

	$('.externalControlsToggle').click(function() {
		var el = $($(this).attr('href'));
		if (el.dialog('isOpen')) {
			el.dialog('close');
		} else {
			el.dialog('open');
		}
		return false;
	});

	$('#localExtCtrl').dialog({
		autoOpen: false,
		closeOnEscape: true,
		draggable: true,
		resizable: false,
		width: 480,
		height: 300,
		title: 'External controls'
	})
		.find('input:text').addClass('ui-widget-content');
	$('#submitResult').dialog({
		autoOpen: false,
		closeOnEscape: true,
		draggable: true,
		resizable: false,
		width: $('#submitFrame').width(),
		height: $('#submitFrame').height() + 65,
		title: "Form submit result"				
	});

	$('form').submit(function() {
		if (!$('#submitResult').dialog('isOpen')) $('#submitResult').dialog('open');
	});


	// Multiselect controls
	var getVisibleMultiselect = function() {
		return $('#tabs-' + (parseInt($('#tabs').tabs('option', 'selected')) + 1)).find('select.multiselect[multiple]');
	};

	$('#ec_toggleEnabled').click(function(event) {
		var multiselect = getVisibleMultiselect();
		multiselect.multiselect('enabled', !multiselect.multiselect('enabled'));
		alert( "Element is " + (multiselect.multiselect('enabled') ? 'enabled' : 'disabled') );
	});
	$('#ec_checkValues').click(function() {
		var multiselect = getVisibleMultiselect();
		var values = multiselect.multiselect('selectedValues');
		if (0 === values.length) {
			alert("There is currently no selected value");
		} else if (1 === values.length) {
			alert("There is currently only 1 selected value : " + values[0]);
		} else {
			alert( "There are currently " + values.length + " selected values:\n\n" + values.join(', '));
		}
	});
	$('#ec_buttonSelectAll').click(function() {
		getVisibleMultiselect().multiselect('selectAll');
	});
	$('#ec_buttonSelectNone').click(function() {
		getVisibleMultiselect().multiselect('selectNone');
	});
	$('#ec_buttonSearch').click(function() {
		getVisibleMultiselect().multiselect('search', $('#ec_inputSearch').val() );
	});
	$('#ec_buttonItemAdd').click(function() {
		getVisibleMultiselect().multiselect('select', $('#ec_inputItem').val() );
	});
	$('#ec_buttonItemRemove').click(function() {
		getVisibleMultiselect().multiselect('deselect', $('#ec_inputItem').val() );
	});

	$('.options-list').find('.option-description, .option-examples').hide().end()
	.find('.option-name a').click(function() {
		var a = $(this);
		var p = a.parents(a.attr('href'));
		p.find('.option-examples, .option-description')['slide' + (p.find('.option-description').is(':visible') ? 'Up' : 'Down')]('fast');
		return false;
	});
	$('.methods-list').find('.method-header > dl, .method-description').hide().end()
	.find('.method-name a').click(function() {
		var a = $(this);
		var p = a.parents(a.attr('href'));
		p.find('.method-header > dl, .method-description')['slide' + (p.find('.method-description').is(':visible') ? 'Up' : 'Down')]('fast');
		return false;
	});
	$('.events-list').find('.event-description, .event-examples').hide().end()
	.find('.event-name a').click(function() {
		var a = $(this);
		var p = a.parents(a.attr('href'));
		p.find('.event-examples, .event-description')['slide' + (p.find('.event-description').is(':visible') ? 'Up' : 'Down')]('fast');
		return false;
	});

});
