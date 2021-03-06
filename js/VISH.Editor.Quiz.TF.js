/*
 * Ture/False Quiz Module, based on MC module
 * Closure: inherit is not possible, rewrite
 */
VISH.Editor.Quiz.TF = (function(V,$,undefined){
	var addQuizOptionButtonClass = "add_quiz_option_tf";
	var deleteQuizOptionButtonClass = "delete_quiz_option_tf";
	var tfCheckbox = "tfCheckbox";
	var initialized = false;

	var init = function(){
		if(!initialized){
			$(document).on('click', '.' + 'mcContainer', _clickOnQuizArea);
			$(document).on('click','.'+ addQuizOptionButtonClass, _clickToAddOptionInQuiz);
			$(document).on('click','.'+ deleteQuizOptionButtonClass, _removeOptionInQuiz);
			$(document).on('click','.'+ tfCheckbox, _onCheckboxClick);
			initialized = true;
		}
	};

	/*
	 * Manage click events
	 */
	var _clickOnQuizArea = function (event) {
		switch (event.target.classList[0]) {
			case "mcContainer":
				V.Editor.setCurrentArea($("#" + event.target.parentElement.id));
				break;
			case "mc_option_text":
				V.Editor.setCurrentArea($("#" + event.target.parentElement.parentElement.parentElement.parentElement.id));
				break;
			case "mc_option":
				V.Editor.setCurrentArea($("#" + event.target.parentElement.parentElement.parentElement.id));
				break;
			default:
				break;
		}
	};

	/*
	 * Change checkbox status
	 */
	var _onCheckboxClick = function(event){
		var check = $(event.target).attr("check");
		var column = $(event.target).attr("column");

		switch(column){
			case "true":
				if(check==="true"){
					V.Quiz.updateCheckbox(event.target,"none");
				} else {
					var falseColumnCheckbox = $("tr").has(event.target).find(".tfCheckbox[column='false']");
					V.Quiz.updateCheckbox(falseColumnCheckbox,"none");
					V.Quiz.updateCheckbox(event.target,"true");
				}
				break;
			case "false":
				if(check==="false"){
					V.Quiz.updateCheckbox(event.target,"none");
				} else {
					var trueColumnCheckbox = $("tr").has(event.target).find(".tfCheckbox[column='true']");
					V.Quiz.updateCheckbox(trueColumnCheckbox,"none");
					V.Quiz.updateCheckbox(event.target,"false");
				}
				break;
			default:
				break;
		}
	};

	/*
	 * Create an empty MC Quiz
	 */
	var add = function(area) {
		area.append(_getDummy());
		area.find(".menuselect_hide").remove(); 
		area.attr('type','quiz');
		area.attr('quiztype', V.Constant.QZ_TYPE.TF);
		_launchTextEditorForQuestion(area);
		_addOptionInQuiz(area);
		V.Editor.addDeleteButton(area);
	};

	var _getDummy = function(){
		return "<div class='tfContainer'><div class='mc_question_wrapper'></div><ul class='mc_options'></ul><img src='"+V.ImagesPath+ "icons/add.png' class='"+addQuizOptionButtonClass+"'/><input type='hidden' name='quiz_id'/></div></div>";
	};

	var _getOptionDummy = function(){
		return "<li class='mc_option'><div class='mc_option_wrapper'><span class='mc_option_index'></span><div class='mc_option_text'></div><table class='mc_checks'><tr class='checkFirstRow'><td><img src='"+V.ImagesPath+ "icons/ve_delete.png' class='"+deleteQuizOptionButtonClass+"'/></td><td><img src='"+V.ImagesPath+ "quiz/checkbox.png' class='"+tfCheckbox+"' column='true' check='none'/></td><td><img src='"+V.ImagesPath+ "quiz/checkbox.png' class='"+tfCheckbox+"' column='false' check='none'/></td></tr></table></div></li>";
	};

	/*
	 * AddOptionInQuiz called from click event
	 */
	var _clickToAddOptionInQuiz = function (event) {
		var area = $("#" + event.target.parentElement.parentElement.id);
		V.Editor.setCurrentArea(area);
		_addOptionInQuiz(area);
	};

	var _addOptionInQuiz = function (area,value,check) {
		var nChoices = $(area).find("li.mc_option").size();
		var quiz_option = _getOptionDummy();
		var quiz_option = $(quiz_option).attr("nChoice",(nChoices+1));
		$(area).find(".mc_options").append(quiz_option);
		_refreshChoicesIndexs(area);
		if(check==="true"){
			V.Quiz.updateCheckbox($(quiz_option).find("td > img")[1],check);
		} else if(check==="false"){
			V.Quiz.updateCheckbox($(quiz_option).find("td > img")[2],check);
		}
		_launchTextEditorForOptions(area, nChoices,value);
		if(nChoices>0) {
			$(area).find("li[nChoice='"+(nChoices+1)+"']").find("."+deleteQuizOptionButtonClass).css("visibility","visible");
		}
	};

	var _removeOptionInQuiz = function (event) {
		var area = $("div[type='quiz']").has(event.target);
		V.Editor.setCurrentArea(area);
		var liToRemove = $("li.mc_option").has(event.target);
		$(liToRemove).remove();
		_refreshChoicesIndexs(area);
	};

	var _refreshChoicesIndexs = function(area){
		$(area).find("li.mc_option").each(function(index, option_element){
			$(option_element).find(".mc_option_index").text(String.fromCharCode(96+index+1)+")");
		});
	};

	var _launchTextEditorForQuestion = function(area,question){
		var textArea = $(area).find(".mc_question_wrapper");
		if(!question){
			V.Editor.Text.launchTextEditor({}, textArea, "", {forceNew: true, fontSize: 38, focus: true, autogrow: true});
		} else {
			V.Editor.Text.launchTextEditor({}, textArea, question, {autogrow: true});
		}
	};

	var _launchTextEditorForOptions = function(area,nChoice,value){
		var first = (nChoice===0);
		var textArea = $(area).find(".mc_option_text")[nChoice];
		if(!value){
			if(first){
				V.Editor.Text.launchTextEditor({}, textArea, V.I18n.getTrans("i.QuizzesWriteOptions"), {forceNew: true, fontSize: 24, autogrow: true, placeholder: true});
			} else {
				V.Editor.Text.launchTextEditor({}, textArea, "", {forceNew: true, fontSize: 24, autogrow: true, focus: true});
			}
		}else{
			V.Editor.Text.launchTextEditor({}, textArea, value, {autogrow: true});
		}
	};

	/*
	 * Generate JSON
	 */
	var save = function(area){
		var textArea = $(area).find(".mc_question_wrapper");
		var quiz = {};
		quiz.quizType = V.Constant.QZ_TYPE.TF;
		// Self-assessment
		quiz.selfA = false;

		var questionInstance = V.Editor.Text.getCKEditorFromTextArea($(area).find(".mc_question_wrapper"));
		quiz.question = {};
		quiz.question.value = questionInstance.getPlainText();
		quiz.question.wysiwygValue = questionInstance.getData();
	 	
		quiz.choices = [];

		var nChoices = $(area).find("li.mc_option").size();
		var optionTextAreas = $(area).find(".mc_option_text");

		for(var i=0; i<nChoices; i++){
			var textArea = optionTextAreas[i];
			var optionInstance = V.Editor.Text.getCKEditorFromTextArea(textArea);
			var choice = {};
			choice.id = (i+1).toString();
			choice.value = optionInstance.getPlainText();
			choice.wysiwygValue = optionInstance.getData();
			var trueColumCheckbox = $(textArea).parent().find(".tfCheckbox[column='true']");
			if($(trueColumCheckbox).attr("check")==="true"){
				choice.answer = true;
				quiz.selfA = true;
			} else {
				var falseColumCheckbox = $(textArea).parent().find(".tfCheckbox[column='false']");
				if($(falseColumCheckbox).attr("check")==="false"){
					choice.answer = false;
					quiz.selfA = true;
				} else {
					choice.answer = "?";
				}
			}
			quiz.choices.push(choice);
		}

		return quiz;
	};

	/*
	 * Render the quiz in the editor
	 * slide is the area and contains all the required parameters
	 */
	var draw = function(area,quiz){
		//Draw question
		$(area).append(_getDummy());
		$(area).attr('type',V.Constant.QUIZ);
		$(area).attr('quiztype', V.Constant.QZ_TYPE.TF);
		_launchTextEditorForQuestion(area,quiz.question.wysiwygValue);
		V.Editor.addDeleteButton(area);

		//Draw choices (checking selfA)
		$(quiz.choices).each(function(index,choice){
			var check = undefined;
			if(quiz.selfA){
				if(choice.answer===true){
					check = "true";
				} else if(choice.answer===false){
					check = "false";
				}
			}
			_addOptionInQuiz(area,choice.wysiwygValue,check);
		});
	};

	var isSelfAssessment = function(quizDOM){
		var sA = false;
		$(quizDOM).find("img.tfCheckbox").each(function(index,checkbox){
			if(($(checkbox).attr("check")==="true")||($(checkbox).attr("check")==="false")){
				sA = true;
			}
		});
		return sA;
	};

	return {
		init				: init,
		add					: add,
		save				: save,
		draw				: draw,
		isSelfAssessment	: isSelfAssessment
	};

}) (VISH, jQuery);