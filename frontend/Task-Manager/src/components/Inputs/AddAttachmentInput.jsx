// AddAttachmentsInput.jsx
import React, { useState } from "react";
import { HiMiniPlus, HiOutlineTrash } from "react-icons/hi2";
import { LuPaperclip } from "react-icons/lu";

const AddAttachmentsInput = ({ attachments = [], setAttachments }) => {
  const [option, setOption] = useState("");

  // add current option to attachments if non-empty
  const handleAddOption = () => {
    const trimmed = option.trim();
    if (!trimmed) return;
    setAttachments([...attachments, trimmed]);
    setOption("");
  };

  // remove attachment by index
  const handleDeleteOption = (indexToRemove) => {
    const updatedArr = attachments.filter((_, idx) => idx !== indexToRemove);
    setAttachments(updatedArr);
  };

  // handle Enter key while typing
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddOption();
    }
  };

  return (
    <div className="add-attachments-input">
      {/* List existing attachments */}
      <div className="attachments-list">
        {attachments && attachments.length > 0 ? (
          attachments.map((item, index) => (
            <div className="attachment-item" key={`${item}-${index}`}>
              <div className="attachment-left">
                <LuPaperclip className="attachment-icon" />
                <p className="attachment-text">{item}</p>
              </div>

              <button
                type="button"
                className="attachment-delete-btn"
                aria-label={`Delete attachment ${index + 1}`}
                onClick={() => handleDeleteOption(index)}
              >
                <HiOutlineTrash className="attachment-trash-icon" />
              </button>
            </div>
          ))
        ) : (
          <p className="no-attachments">No attachments yet</p>
        )}
      </div>

      {/* Input to add a new attachment */}
      <div className="add-attachment-row">
        <div className="add-attachment-left">
          <LuPaperclip className="attachment-icon" />
        </div>

        <input
          type="text"
          className="add-attachment-input"
          placeholder="Add file link"
          value={option}
          onChange={({ target }) => setOption(target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Attachment link"
        />

        <button
          type="button"
          className="add-attachment-btn"
          onClick={handleAddOption}
          aria-label="Add attachment"
        >
          <HiMiniPlus />
        </button>
      </div>
    </div>
  );
};

export default AddAttachmentsInput;
