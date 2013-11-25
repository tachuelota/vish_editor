VISH.Quiz = (function(V,$,undefined){
  
	var quizMode; //selfA or realTime
	
	//Quiz in real time
	//Current quiz DOM element
	var currentQuizDOM;
	//JSON of the current quiz session
	var currentQuizSession;
	var currentPolling;
	//Quiz session ID to answer the quiz in real time
	var quizSessionId;


	var initBeforeRender = function(presentation){
		if(presentation.type===V.Constant.QUIZ_SIMPLE){
			quizMode = V.Constant.QZ_MODE.RT;
			if(V.Utils.getOptions().quizSessionId){
				quizSessionId = V.Utils.getOptions().quizSessionId;
			}
		} else {
			quizMode = V.Constant.QZ_MODE.SELFA;
		}
	};

	var init = function(){
		$("#quizSessionNameInput").watermark((V.I18n.getTrans("i.QuizSessionName")));
		V.Quiz.API.init(V.Utils.getOptions().quizSessionAPI);
		V.Quiz.MC.init();
		V.Quiz.TF.init();
		_loadEvents();
	};

	/*
	* Load common events of Quizzes: answer, start live quiz, etc
	*/
	var _loadEvents = function(){
		$(document).on('click', ".quizAnswerButton",_onAnswerQuiz);
		$(document).on('click', ".quizStartButton",_onStartQuiz);
		$(document).on('click', ".quizStopButton",_onStopQuiz);

		$("a#addQuizSessionFancybox").fancybox({
			'autoDimensions' : false,
			'scrolling': 'no',
			'width': '0%',
			'height': '0%',
			'padding': 0,
			"autoScale" : true,
			"onStart" : function(data) {
				loadTab('tab_quiz_session');
				$("#fancybox-close").height(0);
				$("#fancybox-close").css("padding",0);
			},
			'onComplete' : function(data) {
				setTimeout(function (){
					V.ViewerAdapter.updateFancyboxAfterSetupSize();
					if((currentQuizSession)&&(currentQuizSession.url)){
						_loadQr(currentQuizSession.url);
					}
				}, 300);
			},
			"onClosed" : function(){
				_stopPolling();
				_cleanResults();
			}
		});
	};

	var _onAnswerQuiz = function(event){
		var quizDOM = $("div.quizContainer").has(event.target);
		var quizModule = _getQuizModule($(quizDOM).attr("type"));
		if(quizModule){
			if(quizMode===V.Constant.QZ_MODE.SELFA){
				var quizStatus = $(quizDOM).find(".quizAnswerButton").attr("quizstatus");
				if(quizStatus === "retry"){
					quizModule.onRetryQuiz(quizDOM);
				} else {
					quizModule.onAnswerQuiz(quizDOM);
				}
			} else {
				var report = quizModule.getReport(quizDOM);
				_answerRTQuiz(quizDOM,quizModule,report);
			}
		}
	};

	var _answerRTQuiz = function(quizDOM,quizModule,report){
		if(!quizSessionId){
			return;
		}

		if(report.empty===true){
			var options = {};
			options.width = '80%';
			options.text = V.I18n.getTrans("i.QuizEmptyAnswerAlert");
			var button1 = {};
			button1.text = V.I18n.getTrans("i.Ok");
			button1.callback = function(){
				$.fancybox.close();
			}
			options.buttons = [button1];
			V.Utils.showDialog(options);
			return;
		}

		quizModule.disableQuiz(quizDOM);
		_loadingAnswerButton(quizDOM);

		var answers = report.answers;

		V.Quiz.API.sendAnwers(answers, quizSessionId,
			function(data){
				disableAnswerButton(quizDOM);

				var options = {};
				options.width = '80%';
				options.text = V.I18n.getTrans("i.QuizSubmittedAlert");
				var button1 = {};
				button1.text = V.I18n.getTrans("i.Ok");
				button1.callback = function(){
					$.fancybox.close();
				}
				options.buttons = [button1];
				V.Utils.showDialog(options);
			}, 
			function(error){
				disableAnswerButton(quizDOM);

				var options = {};
				options.width = '80%';
				options.text = V.I18n.getTrans("i.QuizNotSubmittedAlert");
				var button1 = {};
				button1.text = V.I18n.getTrans("i.Ok");
				button1.callback = function(){
					$.fancybox.close();
				}
				options.buttons = [button1];
				V.Utils.showDialog(options);
		});
	};

	var _onStartQuiz = function(event){
		var startButton = $(event.target);
		var quizDOM = $("div.quizContainer").has(startButton);

		switch($(startButton).attr("quizStatus")){
			case "running":
				$("#fancybox-close").hide();
				$("a#addQuizSessionFancybox").trigger("click");
				break;
			case "loading":
				break;
			case "stop":
			default:
				_startNewQuizSession(quizDOM);
			break;
		}
	};

	var _startNewQuizSession = function(quizDOM){
		if(currentQuizSession){
			var options = {};
			options.width = '80%';
			options.text = V.I18n.getTrans("i.QuizMultipleLaunchAlert");
			var button1 = {};
			button1.text = V.I18n.getTrans("i.Ok");
			button1.callback = function(){
				$.fancybox.close();
			}
			options.buttons = [button1];
			V.Utils.showDialog(options);
			return;
		}
		_loadingLaunchButton(quizDOM);
		var quizJSON = _getQuizJSONFromQuiz(quizDOM);
		V.Quiz.API.startQuizSession(quizDOM,quizJSON,_onQuizSessionReceived,_onQuizSessionReceivedError);
	};

	var _onQuizSessionReceived = function(quiz,quizSession){
		currentQuizDOM = quiz;
		currentQuizSession = quizSession;

		_runningLaunchButton(quiz);
		$("a#addQuizSessionFancybox").trigger("click");
	};

	var _onQuizSessionReceivedError = function(quizDOM,error){
		_enableLaunchButton(quizDOM);

		//Show error message
		var options = {};
		options.width = '80%';
		options.text = V.I18n.getTrans("i.QuizCreateSessionError");
		var button1 = {};
		button1.text = V.I18n.getTrans("i.Ok");
		button1.callback = function(){
			$.fancybox.close();
		}
		options.buttons = [button1];
		V.Utils.showDialog(options);
		return;
	};

	var _getQuizJSONFromQuiz = function(quizDOM){
		var slideDOM = $("article").has(quizDOM);
		return _getQuizJSONFromSlide(slideDOM);
	};

	var _getQuizJSONFromSlide = function(slideDOM){
		var slideId = $(slideDOM).attr("id");
		var presentation = V.Viewer.getCurrentPresentation();
		if((slideId)&&(presentation)){
			var slides = presentation.slides;
			var sL = slides.length;
			for(var i=0; i<sL; i++){
				if(slides[i].id==slideId){
					//Look for quiz element
					var elements = slides[i].elements;
					var eL = elements.length;
					for(var j=0; j<eL; j++){
						if(elements[j].type==V.Constant.QUIZ){
							return elements[j].quiz_simple_json;
						}
					}
				}
			}
		}
	};

	var _onStopQuiz = function(event){
		var options = {};
		options.width = '80%';
		options.text = V.I18n.getTrans("i.QuizSaveConfirmation");

		options.buttons = [];

		var button1 = {};
		button1.text = V.I18n.getTrans("i.cancel");
		button1.extraclass = "quizSession_button_cancel";
		button1.callback = function(){
			_onCloseQuizSession('cancel');
		}
		options.buttons.push(button1);

		var button2 = {};
		button2.text = V.I18n.getTrans("i.No");
		button2.extraclass = "quizSession_button_no";
		button2.callback = function(){
			_onCloseQuizSession('no');
		}
		options.buttons.push(button2);
		
		var button3 = {};
		button3.text = V.I18n.getTrans("i.Yes");
		button3.extraclass = "quizSession_button_yes";
		button3.callback = function(){
			_onCloseQuizSession('yes');
		}
		options.buttons.push(button3);

		var input = document.createElement("input");
		$(input).attr("id","quizSessionNameInput");
		$(input).attr("title",V.I18n.getTrans("i.tooltip.QSInput"));
		$(input).addClass("quizSessionNameInput");
		$(input).watermark((V.I18n.getTrans("i.QuizSessionName")));
		options.middlerow = $(input);
		options.middlerowExtraClass = "mr_quizSession";

		options.buttonsWrapperClass = "forceCenter";
		
		V.Utils.showDialog(options);
	};

	var _onCloseQuizSession = function(saving){
		var name = undefined;
		switch(saving){
			case "yes":
				$(".quizSessionNameInput").each(function(index,pn){
					if($(pn).is(":visible")){
						name = $(pn).val();
					}
				});
				$(".quizSession_button_yes").addClass("quizStartButtonLoading");
				_closeQuizSession(name);
				break;
			case "no":
				$(".quizSession_button_no").addClass("quizStartButtonLoading");
				_deleteQuizSession();
				break;
			case "cancel":
			default:
				$.fancybox.close();
				break;
		}
	};

	var _closeQuizSession = function(name){
		V.Quiz.API.closeQuizSession(currentQuizSession.id,name,function(data){
			//Success
			_afterCloseQuizSession();
		}, function(){
			//Failure
			_afterCloseQuizSession();
		});
	};

	var _afterCloseQuizSession = function(){
		$.fancybox.close();
		$(".quizSession_button_no").removeClass("quizStartButtonLoading");
		$(".quizSession_button_yes").removeClass("quizStartButtonLoading");
		_enableLaunchButton(currentQuizDOM);
		currentQuizDOM = null;
		currentQuizSession = null;
	}

	var _deleteQuizSession = function(){
		V.Quiz.API.deleteQuizSession(currentQuizSession.id);
		//Don't wait for the callback in this case
		_afterCloseQuizSession();
	};

	/**
	* Function to render a quiz inside an article (a slide)
	*/
	var render = function(elJSON,template){
		var quizModule = _getQuizModule(elJSON.quiztype);
		if(quizModule){
			var quizDOM = quizModule.render(elJSON,template);
			return "<div id='"+elJSON['id']+"' class='quizWrapper "+template+"_"+elJSON['areaid']+" "+template+"_quiz"+"'>"+quizDOM+"</div>";
		}
	};

	var renderButtons = function(selfA){
		var quizButtons = $("<div class='quizButtons'></div>");

		if((quizMode === V.Constant.QZ_MODE.SELFA)&&((V.Configuration.getConfiguration().mode===V.Constant.VISH)||(V.Configuration.getConfiguration()["mode"]===V.Constant.NOSERVER))&&(V.User.isLogged())&&(!V.Utils.getOptions().preview)){
			var startButton = $("<input type='button' class='buttonQuiz quizStartButton' value='"+V.I18n.getTrans("i.QuizLaunch")+"'/>");
			$(quizButtons).append(startButton);
		}
		if((selfA)||(quizMode === V.Constant.QZ_MODE.RT)){
			var answerButton = $("<input type='button' class='buttonQuiz quizAnswerButton' value='"+V.I18n.getTrans("i.QuizButtonAnswer")+"'/>");
			$(quizButtons).append(answerButton);
		}

		return quizButtons;
	};


	/*
	* Answer button states: Enabled, Retry, Loading and Disabled 
	*/

	var enableAnswerButton = function(quiz){
		var answerButton = $(quiz).find("input.quizAnswerButton");
		$(answerButton).removeAttr("disabled");
		$(answerButton).removeClass("quizStartButtonLoading");
		$(answerButton).removeAttr("quizStatus");
		$(answerButton).attr("value",V.I18n.getTrans("i.QuizButtonAnswer"));
	}

	var retryAnswerButton = function(quiz){
		var answerButton = $(quiz).find("input.quizAnswerButton");
		$(answerButton).removeAttr("disabled");
		$(answerButton).removeClass("quizStartButtonLoading");
		// $(answerButton).addClass("quizAnswerButtonRetry");
		$(answerButton).attr("quizStatus","retry");
		$(answerButton).attr("value",V.I18n.getTrans("i.QuizRetry"));
	}

	var _loadingAnswerButton = function(quiz){
		var answerButton = $(quiz).find("input.quizAnswerButton");
		$(answerButton).attr("disabled", "disabled");
		$(answerButton).addClass("quizStartButtonLoading");
		$(answerButton).attr("quizStatus","loading");
	}

	var disableAnswerButton = function(quiz){
		var answerButton = $(quiz).find("input.quizAnswerButton");
		$(answerButton).attr("disabled", "disabled");
		$(answerButton).addClass("quizAnswerButtonDisabled");
		$(answerButton).removeClass("quizStartButtonLoading");
		$(answerButton).attr("quizStatus","disabled");
	}


	/*
	* Launch button states: Enabled, Loading and Running
	*/
	var _enableLaunchButton = function(quiz){
		var startButton = $(quiz).find("input.quizStartButton");
		$(startButton).removeAttr("disabled");
		$(startButton).removeClass("quizStartButtonLoading");
		$(startButton).removeAttr("quizStatus");
		$(startButton).attr("value",V.I18n.getTrans("i.QuizLaunch"));
	}

	var _loadingLaunchButton = function(quizDOM){
		var startButton = $(quizDOM).find("input.quizStartButton");
		$(startButton).attr("disabled", "disabled");
		$(startButton).addClass("quizStartButtonLoading");
		$(startButton).attr("quizStatus","loading");
		$(startButton).attr("value",V.I18n.getTrans("i.QuizLaunch"));
	}

	var _runningLaunchButton = function(quiz){
		var startButton = $(quiz).find("input.quizStartButton");
		$(startButton).removeAttr("disabled");
		$(startButton).removeClass("quizStartButtonLoading");
		$(startButton).attr("quizStatus","running");
		$(startButton).attr("value",V.I18n.getTrans("i.QuizButtonOptions"));
	}

   /*
	*  Fancybox
	*/
	var loadTab = function(tab_id){
		//hide previous tab
		$(".fancy_viewer_tab_content").hide();
		//show content
		$("#" + tab_id + "_content").show();
		//deselect all of them
		$(".fancy_viewer_tab").removeClass("fancy_selected");
		//select the correct one
		$("#" + tab_id).addClass("fancy_selected");
		//hide previous help button
		$(".help_in_fancybox_viewer").hide();
		//show correct one
		$("#"+ tab_id + "_help").show();

		switch(tab_id){
			case "tab_quiz_session":
				_loadQuizSession();
				break;
			case "tab_quiz_stats":
				_loadStats();
				break;
			default:
				break;
		}
		return false;
	};

	var _loadQuizSession = function(){
		_cleanResults();
		if(!currentQuizSession){
			return;
		}

		var myA = $("#tab_quiz_session_url_link");
		$(myA).attr("href",currentQuizSession.url);
		$(myA).html("<p id='tab_quiz_session_url'>"+currentQuizSession.url+"</p>");

		var sharingText = $(currentQuizDOM).find(".mc_question_wrapper_viewer").text().trim();

		var twitter = $("#tab_quiz_session_share_twitter");
		$(twitter).attr("href","https://twitter.com/share?url="+currentQuizSession.url+"&text="+sharingText+"");

		var facebook = $("#tab_quiz_session_share_facebook");
		var facebookUrl = "http://www.facebook.com/sharer.php?s=100&p[url]="+currentQuizSession.url+"&p[title]="+sharingText;
		// &p[summary]=the description/summary you want to share";
		//&p[images][0]=the image you want to share
		$(facebook).attr("href",facebookUrl);

		var gPlus = $("#tab_quiz_session_share_gPlus");
		$(gPlus).attr("href","https://plus.google.com/share?url="+currentQuizSession.url);
	}


	var _loadQr = function(url){
		if(typeof url != "string"){
			return;
		}

		//Draw QR for fancybox
		var container = $(".quizQr");
		$(container).html("");

		$("#tab_quiz_session_content").addClass("temp_shown");
		$(container).addClass("temp_shown");
		var height = $(container).height();
		$(container).removeClass("temp_shown");
		$("#tab_quiz_session_content").removeClass("temp_shown");
		var width = height;

		var qrOptions = {
			// render method: 'canvas' or 'div'
			render: 'canvas', 
			// width and height in pixel
			width: width,
			height: height,
			// QR code color
			color: '#000',
			// background color, null for transparent background
			bgColor: '#fff',
			// the encoded text
			text: url.toString()
		}
		$(container).qrcode(qrOptions);

		//Draw QR for overlay
		var overlayHeight = $("#qr_overlay").height();
		var qrOptions = {
			render: 'canvas', 
			width: overlayHeight,
			height: overlayHeight,
			color: '#000',
			bgColor: '#fff',
			text: url.toString()
		}
		$("#qr_overlay").qrcode(qrOptions);

		var qrDOMFancybox = $(container).find("canvas");
		$(qrDOMFancybox).click(function(){
			$("#qr_overlay").show();
		});

		$("#qr_overlay").click(function(){
			$("#qr_overlay").hide();
		});
	};

	var _openQrOverlay = function(qr){
		$("#qr_overlay").show();
	}

	var _updateQrSizeOnOverlay = function(){
		var qr = $("#qr_overlay").find("canvas");
		var qrSize = Math.min($("#qr_overlay").width(),$("#qr_overlay").height());
		$(qr).width(qrSize);
		$(qr).height(qrSize);
	}

	var _closeQrOverlay = function(){
		$("#qr_overlay").hide();
	} 

	var _loadStats = function(){
		_cleanResults();
		V.Quiz.API.getResults(currentQuizSession.id, function(results){
			_drawResults(results,{"first": true});
			_startPolling();
		});
	};

	var _startPolling = function(){
		_stopPolling();
		currentPolling = setInterval(function(){
			if(!currentQuizSession){
				_stopPolling();
				return;
			}
			V.Quiz.API.getResults(currentQuizSession.id, function(results){
				_drawResults(results,{"first": false});
			});
		},2000);
	};

	var _stopPolling = function(){
		if(currentPolling){
			clearInterval(currentPolling);
		}
	};

	var _drawResults = function(results,options){
		//Prepare canvas
		var canvas = $("#quiz_chart");
		var desiredWidth = $("#fancybox-content").width();
		var desiredHeight = $("#fancybox-content").height()*0.8;
		$(canvas).width(desiredWidth);
		$(canvas).height(desiredHeight);
		$(canvas).attr("width",desiredWidth);
		$(canvas).attr("height",desiredHeight);

		var quizModule = _getQuizModule($(currentQuizDOM).attr("type"));
		if(quizModule){
			$("#quiz_chart").show();
			quizModule.drawResults(currentQuizDOM,results,options);
		}
	};

	var _cleanResults = function(){
		var canvas = $("#quiz_chart");
		var ctx = $(canvas).get(0).getContext("2d");
		ctx.clearRect(0, 0, $(canvas).width(), $(canvas).height());
		$(canvas).hide();
	};


	/*
	* Utils
	*/
	var _getQuizModule = function(quiz_type){
		switch (quiz_type) {
			case V.Constant.QZ_TYPE.OPEN:
				break;
			case V.Constant.QZ_TYPE.MCHOICE:
				return V.Quiz.MC;
				break;
			case V.Constant.QZ_TYPE.TF:
				return V.Quiz.TF;
				break;
			default:
				return null; 
				break;
		}
	};

	var updateCheckbox = function(checkbox,check){
		if(typeof check == "boolean"){
			check = check.toString();
		}

		var imagePathRoot = V.ImagesPath+ "quiz/checkbox";
		switch(check){
			case "true":
				$(checkbox).attr("check","true");
				$(checkbox).attr("src",imagePathRoot+"_checked.png");
				break;
			case "false":
				$(checkbox).attr("check","false");
				$(checkbox).attr("src",imagePathRoot+"_wrong.png");
				break;
			case "none":
			default:
				$(checkbox).attr("check","none");
				$(checkbox).attr("src",imagePathRoot+".png");
				break;
		}
	};

	var aftersetupSize = function(increase){
		setTimeout(function(){
			if((currentQuizSession)&&(currentQuizSession.url)){
				_loadQr(currentQuizSession.url);
				_updateQrSizeOnOverlay();
			}
		},500);
	};

	return {
		initBeforeRender  	: initBeforeRender,
		init              	: init,
		render            	: render,
		renderButtons     	: renderButtons,
		updateCheckbox    	: updateCheckbox,
		enableAnswerButton  : enableAnswerButton,
		retryAnswerButton	: retryAnswerButton,
		disableAnswerButton : disableAnswerButton,
		loadTab             : loadTab,
		aftersetupSize    	: aftersetupSize
	};
	
}) (VISH, jQuery);

 