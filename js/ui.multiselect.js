/*
 * jQuery UI Multiselect
 *
 * Authors:
 *	Michael Aufreiter (quasipartikel.at)
 *  Yanick Rochon (yanick.rochon[at]gmail[dot]com)
 * 
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 * 
 * http://www.quasipartikel.at/multiselect/
 *
 * 
 * Depends:
 *	ui.core.js
 *	ui.sortable.js
 * 
 * Todo:
 *  use Element storage to avoid circular references
 *  $('selector').data()....
 *  Make batch actions faster
 */



/* String.contains - taken from Mootools */
String.prototype.contains = function(string, separator) {
	return (separator) ? (separator + this + separator).indexOf(separator + string + separator) > -1 : this.indexOf(string) > -1;
};

(function($) {

$.widget("ui.multiselect", {
  _init: function() {
		this.element.hide();
		this.id = this.element.attr("id");
		this.container = $('<div class="ui-multiselect ui-helper-clearfix ui-widget"></div>').insertAfter(this.element);
		this.count = 0; // number of currently selected options
		this.selectedContainer = $('<div class="selected"></div>').appendTo(this.container);
		this.availableContainer = $('<div class="available"></div>').appendTo(this.container);
		this.selectedActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><span class="count">0 items selected</span><a href="#" class="remove-all">Remove All</a></div>').appendTo(this.selectedContainer);
		this.availableActions = $('<div class="actions ui-widget-header ui-helper-clearfix"><input type="text" class="search ui-widget-content ui-corner-all"/><a href="#" class="add-all">Add All</a></div>').appendTo(this.availableContainer);
		this.selectedList = $('<ul class="selected"></ul>').bind('selectstart', function(){return false;}).appendTo(this.selectedContainer);
		this.availableList = $('<ul class="available"></ul>').bind('selectstart', function(){return false;}).appendTo(this.availableContainer);
		
		var that = this;

		// set dimensions
		this.container.width(this.element.width()+1);
		this.selectedList.width(this.element.width()*0.6);
		this.availableList.width(this.element.width()*0.4);

		this.selectedList.height(this.element.height());
		this.availableList.height(this.element.height());
		
		if ( !this.options.animated ) {
			this.options.show = 'show';
			this.options.hide = 'hide';
		}
		
		// init lists
		this._populateLists(this.element.find('option'));
		
		// make selection sortable
		if (this.options.sortable) {
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
		
		// set up livesearch
		if (this.options.searchable) {
			this.availableContainer.find('input.search')
				.keyup(function() {
					that._filter.apply(this, [that.availableList]);
				}).keyup()
				.parents('form').submit(function(){
					return false;
				});
		}
		
		// batch actions
		$(".remove-all").click(function() {
			that._populateLists(that.element.find('option').removeAttr('selected'));
			return false;
		});
		$(".add-all").click(function() {
			that._populateLists(that.element.find('option').attr('selected', 'selected'));
			return false;
		});
  },
	destroy: function() {
		this.element.show();
		this.container.remove();

		$.widget.prototype.destroy.apply(this, arguments);
	},
  _populateLists: function(options) {
    this.selectedList.empty();
    this.availableList.empty();
    
    var that = this;
    var items = $(options.map(function(i) {
      var item = that._getOptionNode(this).appendTo(this.selected ? that.selectedList : that.availableList).show();
			if (this.selected) that.count += 1;
			that._applyItemState(item);
			item[0].idx = i;
			return item[0];
    }));

		// register events
		this._registerAddEvents(this.availableList.find('a.action'));
		this._registerRemoveEvents(this.selectedList.find('a.action'));
		this._registerHoverEvents(this.container.find('li'));
		
		// update count
		this._updateCount();
  },
	_updateCount: function() {
		this.selectedContainer.find('span.count').text(this.count+" items selected");
	},
	_getOptionNode: function(option) {
		var node = $('<li class="ui-state-default"> \
			<span class="ui-icon"/> \
			'+$(option).text()+'\
			<a href="#" class="action"><span class="ui-corner-all ui-icon"/></a> \
			</li>').hide();
		node[0].optionLink = option;
		return node;
	},
	_setSelected: function(item, selected) {
		try {
			item[0].optionLink.selected = selected;
		} catch (e) {
			/* @HACK: ignore - IE6 complaints for norhing as the attribute was indeed properly set! (yr - 2009-04-28) */
		}

		if ( selected ) {
			// clone the item
			var selectedItem = item.clone(); selectedItem[0].optionLink = item[0].optionLink; selectedItem[0].idx = item[0].idx;
			item[this.options.hide](this.options.animated, function() { $(this).remove(); });
			selectedItem.appendTo(this.selectedList).hide()[this.options.show](this.options.animated);
			
			this._applyItemState(selectedItem);
			this._registerHoverEvents(selectedItem);
			this._registerRemoveEvents(selectedItem.find('a.action'));
		} else {
			
			// look for successor based on initial option index
			var items = this.availableList.find('li');
			var succ = null; var i = 0;
			while (i<items.length) {
				if ((i==0 && items[i].idx > item[0].idx) || ((items[i].idx > item[0].idx) && (items[i-1].idx < item[0].idx))) {
					succ = items[i];
					break;
				}
				i++;
			}
			
			// clone the item
			var availableItem = item.clone(); availableItem[0].optionLink = item[0].optionLink; availableItem[0].idx = item[0].idx;
			succ ? availableItem.insertBefore($(succ)) : availableItem.appendTo(this.availableList);
			item[this.options.hide](this.options.animated, function() { $(this).remove(); });
			availableItem.hide()[this.options.show](this.options.animated);
			
			this._applyItemState(availableItem);
			this._registerHoverEvents(availableItem);
			this._registerAddEvents(availableItem.find('a.action'));
		}
	},
	_applyItemState: function(item) {
		if (item[0].optionLink.selected) {
			if (this.options.sortable)
				item.children('span').addClass('ui-icon-arrowthick-2-n-s').removeClass('ui-helper-hidden').addClass('ui-icon');
			else
				item.children('span').removeClass('ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden').removeClass('ui-icon');
			item.find('a.action span').addClass('ui-icon-minus').removeClass('ui-icon-plus');
		} else {
			item.children('span').removeClass('ui-icon-arrowthick-2-n-s').addClass('ui-helper-hidden').removeClass('ui-icon');
			item.find('a.action span').addClass('ui-icon-plus').removeClass('ui-icon-minus');
		}
	},
	// taken from John Resig's liveUpdate script
	_filter: function(list) {
		var rows = list.children('li'),
			cache = rows.map(function(){
				return this.innerHTML.toLowerCase();
			});
		
		var term = $.trim( $(this).val().toLowerCase() ), scores = [];

		if ( !term ) {
			rows.show();
		} else {
			rows.hide();

			cache.each(function(i) {
				if (this.contains(term)) { scores.push(i); }
			});

			$.each(scores, function() {
				$(rows[ this ]).show();
			});
		}
	},
	_registerHoverEvents: function(elements) {
		elements.removeClass('ui-state-hover');
		elements.mouseover(function() {
			$(this).addClass('ui-state-hover');
		});
		elements.mouseout(function() {
			$(this).removeClass('ui-state-hover');
		});
	},
	_registerAddEvents: function(elements) {
    var that = this;
    elements.click(function() {
			var item = that._setSelected($(this).parent(), true);
			that.count += 1;
			that._updateCount();
			return false;
    });
  },
  _registerRemoveEvents: function(elements) {
    var that = this;
    elements.click(function() {
			that._setSelected($(this).parent(), false);
			that.count -= 1;
			that._updateCount();
			return false;
    });
  }
});
		
$.extend($.ui.multiselect, {
	defaults: {
		sortable: true,
		searchable: true,
		animated: 'fast',
		show: 'slideDown',
		hide: 'slideUp'
	}
});
	
})(jQuery);