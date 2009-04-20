/*
 * jQuery UI Multiselect
 *
 * Copyright (c) 2008 Michael Aufreiter (quasipartikel.at)
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 * 
 * http://www.quasipartikel.at/multiselect/
 *
 * Depends:
 *	ui.core.js
 *	ui.sortable.js
 */
 

(function($) {

$.widget("ui.multiselect", {
  _init: function() {
	
		// hide this.element
		this.element.hide();
		this.id = this.element.attr("id");
		this.container = $('<div class="ui-multiselect ui-helper-clearfix"></div>').insertAfter(this.element);
		this.selectedList = $('<ul class="selected"></ul>').appendTo(this.container);
		this.availableList = $('<ul class="available"></ul>').appendTo(this.container);
		
		var that = this;

		// set dimensions
		this.container.width(this.element.width()+1);
		this.selectedList.width(this.element.width()*0.6);
		this.availableList.width(this.element.width()*0.4);

		this.selectedList.height(this.element.height());
		this.availableList.height(this.element.height());
		
		this.populateLists();		
		
		// register events
		this.registerAddEvents(this.availableList.find('a.action'));
		this.registerRemoveEvents(this.selectedList.find('a.action'));
		
		if (this.options.sortable) {
			// make current selection sortable
			$(this.selectedList).sortable({
			  containment: 'parent',
			  update: function(event, ui) {
			    // apply the new sort order to the original selectbox
			    that.selectedList.find('li').each(function() {
			      if (this.optionLink) $(this.optionLink).remove().appendTo(that.element);
			    });
			  }
			});
		}
  },
	destroy: function() {
		this.element.show();
		this.container.remove();

		$.widget.prototype.destroy.apply(this, arguments);
	},
  populateLists: function() {
    this.selectedList.empty();
    this.availableList.empty();
    
    var that = this;
    this.element.find('option').each(function(i) {
	
      var item = $('<li class="ui-state-default"> \
										<span class="ui-icon"/> \
										'+$(this).text()+'\
										<a href="#" class="action"><span class="ui-corner-all ui-icon"/></a> \
										</li>').appendTo(that.availableList);
										
      item.appendTo(this.selected ? that.selectedList : that.availableList);
			
      // store the index as a property
      item[0].optionLink = this;
			that.applyItemState(item[0]);
    });

		
		this.registerHoverEvents(this.container.find('li'));
  },
	applyItemState: function(item) {
		if (item.optionLink.selected) {
			$(item).removeClass('ui-priority-secondary');
			if (this.options.sortable)
				$(item).find('span:first').addClass('ui-icon-arrowthick-2-n-s').removeClass('ui-helper-hidden').addClass('ui-icon');
			else
				$(item).find('span:first').removeClass('ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden').removeClass('ui-icon');
			$(item).find('a.action span').addClass('ui-icon-minus').removeClass('ui-icon-plus');
		} else {
			$(item).addClass('ui-priority-secondary');
			$(item).find('span:first').removeClass('ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden').removeClass('ui-icon');
			$(item).find('a.action span').addClass('ui-icon-plus').removeClass('ui-icon-minus');
		}
	},
	registerHoverEvents: function(elements) {
		// extract this
		elements.removeClass('ui-state-hover');
		
		elements.mouseover(function() {
			$(this).addClass('ui-state-hover');
		});
		
		elements.mouseout(function() {
			$(this).removeClass('ui-state-hover');
		});
	},
  registerAddEvents: function(elements) {
    var that = this;
    elements.click(function() {
      // select the corresponding option
      option = $(this).parent()[0].optionLink;
      option.selected = true;
      $(option).remove().appendTo(that.element);
      
      // move element to selectedList and reregister events
      var li = $(this).parent().remove().appendTo(that.selectedList);
			that.applyItemState(li[0]);
			
      that.registerRemoveEvents($(this));
			that.registerHoverEvents(li);
			return false;
    });

  },
  registerRemoveEvents: function(elements) {
    var that = this;
    elements.click(function() {
			
      // deselect the corresponding option
      $(this).parent()[0].optionLink.selected = false;
      // move element to availableList and reregister events
      var li = $(this).parent().remove().appendTo(that.availableList);
			that.applyItemState(li[0]);
      that.registerAddEvents($(this));
			that.registerHoverEvents(li);
			return false;
    });
  }
});
		
$.extend($.ui.multiselect, {
	getter: "value",
	defaults: {
		sortable: false
	}
});
	
})(jQuery);